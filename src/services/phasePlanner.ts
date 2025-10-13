import { ResourceManager } from "./resourceManager";
import {
  Topic,
  ScheduleDay,
  ResourceSelection,
  Resource,
  ResourceItem,
} from "../models/types";
import { DateUtils } from "../utils/dateUtils";
import { ResourceSelectionUtils } from "../utils/resourceSelectionUtils";

export class PhasePlanner {
  private resourceManager: ResourceManager;
  private usedResources: Set<string> = new Set();
  private topics: Topic[] = [];
  private timeTargets: {
    phase1Target: number;
    phase2Target: number;
    phase3Target: number;
    strategy: string;
  } = {
    phase1Target: 200,
    phase2Target: 220,
    phase3Target: 225,
    strategy: "balanced",
  };

  constructor(resourceManager: ResourceManager) {
    this.resourceManager = resourceManager;
  }

  /**
   * Convert a resource selection to a structured ResourceItem object
   */
  private convertToResourceItem(
    selection: ResourceSelection,
    anchor: Topic
  ): ResourceItem {
    const resource = selection.resource;
    const url = this.extractUrlFromTitle(resource.title);

    // Clean title by removing URL if present
    let cleanTitle = resource.title;
    if (url) {
      cleanTitle = resource.title.replace(/\s*https?:\/\/[^\s]+/g, "").trim();
    }

    // Remove trailing dash and extra spaces
    cleanTitle = cleanTitle.replace(/\s*-\s*$/, "").trim();

    return {
      title: cleanTitle,
      topic_number: resource.key,
      topic_title: anchor.concept_title,
      provider: selection.provider,
      time_minutes: selection.time_minutes,
      url: url,
      high_yield: "high_yield" in resource ? resource.high_yield : undefined,
      resource_type:
        "resource_type" in resource ? resource.resource_type : undefined,
    };
  }

  /**
   * Extract URL from resource title if present
   */
  private extractUrlFromTitle(title: string): string | undefined {
    const urlMatch = title.match(/https?:\/\/[^\s]+/);
    return urlMatch ? urlMatch[0] : undefined;
  }

  /**
   * Aggressively fill remaining time to reach target
   */
  private async fillRemainingTime(
    remainingTime: number,
    targetTime: number,
    blocks: any,
    anchor: Topic,
    usedResources: Set<string>,
    sameDayUsed: Set<string>,
    date: Date,
    phase: number
  ): Promise<number> {
    if (remainingTime <= 0 || 240 - remainingTime >= targetTime) {
      return remainingTime;
    }

    // Get all available resources for aggressive filling
    const kaVideos = await this.resourceManager.getKhanAcademyResources(
      anchor.key,
      "Videos"
    );
    const kaArticles = await this.resourceManager.getKhanAcademyResources(
      anchor.key,
      "Articles"
    );
    const kaDiscretes = await this.resourceManager.getKhanAcademyResources(
      anchor.key,
      "Discrete Practice Questions"
    );
    const jwDiscretes = await this.resourceManager.getJackWestinResources(
      anchor.key
    );
    const allDiscretes = [...kaDiscretes, ...jwDiscretes];

    // Try to add more resources in order of preference
    const resourcesToTry = [
      {
        resources: kaVideos,
        blockName: "science_content",
        slotType: "ka_video",
      },
      {
        resources: kaArticles,
        blockName: "science_content",
        slotType: "ka_article",
      },
      {
        resources: allDiscretes,
        blockName: "science_discretes",
        slotType: "ka_discrete",
      },
    ];

    for (const { resources, blockName, slotType } of resourcesToTry) {
      if (240 - remainingTime >= targetTime) break;

      const selections = ResourceSelectionUtils.selectResourcesForSlot(
        anchor,
        slotType,
        phase,
        resources,
        usedResources,
        remainingTime,
        this.topics,
        sameDayUsed
      );

      for (const selection of selections) {
        if (
          remainingTime >= selection.time_minutes &&
          !sameDayUsed.has(
            ResourceSelectionUtils.getResourceUid(selection.resource)
          ) &&
          !usedResources.has(
            ResourceSelectionUtils.getResourceUid(selection.resource)
          ) &&
          240 - remainingTime < targetTime
        ) {
          blocks[blockName].push(this.convertToResourceItem(selection, anchor));
          remainingTime -= selection.time_minutes;
          const resourceUid = ResourceSelectionUtils.getResourceUid(
            selection.resource
          );
          sameDayUsed.add(resourceUid);
          usedResources.add(resourceUid);
          await this.resourceManager.markResourceAsUsed(
            selection.resource,
            selection.provider,
            DateUtils.formatDate(date)
          );
        }
      }
    }

    // If still not at target, try fallback resources (but still respect never-repeat rule)
    if (240 - remainingTime < targetTime && remainingTime >= 10) {
      const fallbackResources = [
        {
          resources: kaVideos,
          blockName: "science_content",
          slotType: "ka_video",
        },
        {
          resources: kaArticles,
          blockName: "science_content",
          slotType: "ka_article",
        },
        {
          resources: allDiscretes,
          blockName: "science_discretes",
          slotType: "ka_discrete",
        },
      ];

      for (const { resources, blockName, slotType } of fallbackResources) {
        if (240 - remainingTime >= targetTime) break;

        // Get selections while still respecting never-repeat rule
        const fallbackSelections =
          ResourceSelectionUtils.selectResourcesForSlot(
            anchor,
            slotType,
            phase,
            resources,
            usedResources,
            remainingTime,
            this.topics,
            sameDayUsed
          );

        for (const selection of fallbackSelections) {
          if (
            remainingTime >= selection.time_minutes &&
            240 - remainingTime < targetTime
          ) {
            blocks[blockName].push(
              this.convertToResourceItem(selection, anchor)
            );
            remainingTime -= selection.time_minutes;
            sameDayUsed.add(
              ResourceSelectionUtils.getResourceUid(selection.resource)
            );
            await this.resourceManager.markResourceAsUsed(
              selection.resource,
              selection.provider,
              DateUtils.formatDate(date)
            );
          }
        }
      }
    }

    return remainingTime;
  }

  /**
   * Phase 2 specific time filling
   */
  private async fillRemainingTimePhase2(
    remainingTime: number,
    targetTime: number,
    blocks: any,
    anchor: Topic,
    usedResources: Set<string>,
    sameDayUsed: Set<string>,
    date: Date
  ): Promise<number> {
    if (remainingTime <= 0 || 240 - remainingTime >= targetTime) {
      return remainingTime;
    }

    // Get Phase 2 specific resources
    const jwPassages = await this.resourceManager.getJackWestinResources(
      anchor.key
    );
    const scienceOnlyPassages = jwPassages.filter(
      (resource) => !resource.title.toLowerCase().includes("cars")
    );
    const kaDiscretes = await this.resourceManager.getKhanAcademyResources(
      anchor.key,
      "Discrete Practice Questions"
    );
    const jwDiscretes = await this.resourceManager.getJackWestinResources(
      anchor.key
    );
    const allDiscretes = [...kaDiscretes, ...jwDiscretes];
    const phase1UnusedDiscretes = allDiscretes.filter(
      (d) => !ResourceSelectionUtils.isUsedInPhase1(d, usedResources)
    );

    // Try to add more resources in order of preference
    const resourcesToTry = [
      {
        resources: scienceOnlyPassages,
        blockName: "science_passages",
        slotType: "jw_passage",
      },
      {
        resources: phase1UnusedDiscretes,
        blockName: "extra_discretes",
        slotType: "ka_discrete",
      },
    ];

    for (const { resources, blockName, slotType } of resourcesToTry) {
      if (240 - remainingTime >= targetTime) break;

      const selections = ResourceSelectionUtils.selectResourcesForSlot(
        anchor,
        slotType,
        2,
        resources,
        usedResources,
        remainingTime,
        this.topics,
        sameDayUsed
      );

      for (const selection of selections) {
        if (
          remainingTime >= selection.time_minutes &&
          !sameDayUsed.has(
            ResourceSelectionUtils.getResourceUid(selection.resource)
          ) &&
          !usedResources.has(
            ResourceSelectionUtils.getResourceUid(selection.resource)
          ) &&
          240 - remainingTime < targetTime
        ) {
          blocks[blockName].push(this.convertToResourceItem(selection, anchor));
          remainingTime -= selection.time_minutes;
          const resourceUid = ResourceSelectionUtils.getResourceUid(
            selection.resource
          );
          sameDayUsed.add(resourceUid);
          usedResources.add(resourceUid);
          await this.resourceManager.markResourceAsUsed(
            selection.resource,
            selection.provider,
            DateUtils.formatDate(date)
          );
        }
      }
    }

    return remainingTime;
  }

  async initialize(
    topics: Topic[],
    timeTargets?: {
      phase1Target: number;
      phase2Target: number;
      phase3Target: number;
      strategy: string;
    }
  ): Promise<void> {
    this.topics = topics;
    this.usedResources = await this.resourceManager.getUsedResources();
    if (timeTargets) {
      this.timeTargets = timeTargets;
    }
  }

  async planPhase1Day(
    date: Date,
    anchor: Topic,
    usedResources: Set<string>
  ): Promise<ScheduleDay> {
    const blocks: any = {
      science_content: [] as ResourceItem[],
      science_discretes: [] as ResourceItem[],
      cars: [] as ResourceItem[],
      written_review_minutes: 60,
      total_resource_minutes: 0,
    };

    let remainingTime = 240; // 4 hours in minutes
    const sameDayUsed = new Set<string>();

    // Phase 1 Goal: Always pair Kaplan with matching KA content
    // Order: Science content → Science discretes → CARS → Review

    // 1. Science content: 1 Kaplan section + matching KA content (videos + articles)
    let kaplanResources = await this.resourceManager.getKaplanResources(
      anchor.key,
      true
    );

    // Fallback to low-yield Kaplan resources when high-yield are exhausted
    if (kaplanResources.length === 0) {
      kaplanResources = await this.resourceManager.getKaplanResources(
        anchor.key,
        false
      );
    }

    const kaVideos = await this.resourceManager.getKhanAcademyResources(
      anchor.key,
      "Videos"
    );
    const kaArticles = await this.resourceManager.getKhanAcademyResources(
      anchor.key,
      "Articles"
    );

    // Select Kaplan section with high-yield priority
    const kaplanSelections = ResourceSelectionUtils.selectResourcesForSlot(
      anchor,
      "kaplan",
      1,
      kaplanResources,
      usedResources,
      remainingTime,
      this.topics,
      sameDayUsed
    );

    if (kaplanSelections.length > 0) {
      const kaplan = kaplanSelections[0];
      blocks.science_content.push(this.convertToResourceItem(kaplan, anchor));
      remainingTime -= kaplan.time_minutes;
      sameDayUsed.add(ResourceSelectionUtils.getResourceUid(kaplan.resource));
      await this.resourceManager.markResourceAsUsed(
        kaplan.resource,
        kaplan.provider,
        DateUtils.formatDate(date)
      );
    }

    // Add matching KA content (videos + articles)
    const kaVideoSelections = ResourceSelectionUtils.selectResourcesForSlot(
      anchor,
      "ka_video",
      1,
      kaVideos,
      usedResources,
      remainingTime,
      this.topics,
      sameDayUsed
    );

    for (const selection of kaVideoSelections.slice(0, 2)) {
      if (remainingTime >= selection.time_minutes) {
        blocks.science_content.push(
          this.convertToResourceItem(selection, anchor)
        );
        remainingTime -= selection.time_minutes;
        sameDayUsed.add(
          ResourceSelectionUtils.getResourceUid(selection.resource)
        );
        await this.resourceManager.markResourceAsUsed(
          selection.resource,
          selection.provider,
          DateUtils.formatDate(date)
        );
      }
    }

    const kaArticleSelections = ResourceSelectionUtils.selectResourcesForSlot(
      anchor,
      "ka_article",
      1,
      kaArticles,
      usedResources,
      remainingTime,
      this.topics,
      sameDayUsed
    );

    for (const selection of kaArticleSelections.slice(0, 1)) {
      if (remainingTime >= selection.time_minutes) {
        blocks.science_content.push(
          this.convertToResourceItem(selection, anchor)
        );
        remainingTime -= selection.time_minutes;
        sameDayUsed.add(
          ResourceSelectionUtils.getResourceUid(selection.resource)
        );
        await this.resourceManager.markResourceAsUsed(
          selection.resource,
          selection.provider,
          DateUtils.formatDate(date)
        );
      }
    }

    // 2. Science discretes: 1 KA or Jack Westin discrete set
    const kaDiscretes = await this.resourceManager.getKhanAcademyResources(
      anchor.key,
      "Discrete Practice Questions"
    );
    const jwDiscretes = await this.resourceManager.getJackWestinResources(
      anchor.key
    );
    const allDiscretes = [...kaDiscretes, ...jwDiscretes];

    const discreteSelections = ResourceSelectionUtils.selectResourcesForSlot(
      anchor,
      "ka_discrete",
      1,
      allDiscretes,
      usedResources,
      remainingTime,
      this.topics,
      sameDayUsed
    );

    if (discreteSelections.length > 0) {
      const discrete = discreteSelections[0];
      blocks.science_discretes.push(
        this.convertToResourceItem(discrete, anchor)
      );
      remainingTime -= discrete.time_minutes;
      sameDayUsed.add(ResourceSelectionUtils.getResourceUid(discrete.resource));
      await this.resourceManager.markResourceAsUsed(
        discrete.resource,
        discrete.provider,
        DateUtils.formatDate(date)
      );
    }

    // 3. CARS: 2 Jack Westin passages (Phase 1 uses Jack Westin only)
    // CARS passages are NOT science-based and should be randomly assorted
    const carsPassages = await this.resourceManager.getCarsPassages();
    const carsSelections = ResourceSelectionUtils.selectResourcesForSlot(
      anchor,
      "jw_passage",
      2,
      carsPassages,
      usedResources,
      remainingTime,
      this.topics,
      sameDayUsed
    );

    for (const selection of carsSelections.slice(0, 2)) {
      if (remainingTime >= selection.time_minutes) {
        blocks.cars.push(this.convertToResourceItem(selection, anchor));
        remainingTime -= selection.time_minutes;
        sameDayUsed.add(
          ResourceSelectionUtils.getResourceUid(selection.resource)
        );
        await this.resourceManager.markResourceAsUsed(
          selection.resource,
          selection.provider,
          DateUtils.formatDate(date)
        );
      }
    }

    // 4. FILL REMAINING TIME: Aggressively fill to reach target
    const targetTime = this.timeTargets.phase1Target;
    remainingTime = await this.fillRemainingTime(
      remainingTime,
      targetTime,
      blocks,
      anchor,
      usedResources,
      sameDayUsed,
      date,
      1
    );

    // DON'T add more CARS in Phase 1 - preserve for Phase 2

    blocks.total_resource_minutes = 240 - remainingTime;

    return {
      date: DateUtils.formatDate(date),
      kind: "study",
      phase: 1,
      blocks,
    };
  }

  async planPhase2Day(
    date: Date,
    anchor: Topic,
    usedResources: Set<string>
  ): Promise<ScheduleDay> {
    const blocks: any = {
      science_passages: [] as ResourceItem[],
      uworld_set: [] as ResourceItem[],
      extra_discretes: [] as ResourceItem[],
      cars: [] as ResourceItem[],
      written_review_minutes: 60,
      total_resource_minutes: 0,
    };

    let remainingTime = 240;
    const sameDayUsed = new Set<string>();

    // Phase 2 Order: Science passages → UWorld → Extra discretes → CARS → Review

    // 1. Science passages: 2 third-party (same category/subtopic as anchor OK)
    const jwPassages = await this.resourceManager.getJackWestinResources(
      anchor.key
    );
    // Filter out CARS passages for science passages
    const scienceOnlyPassages = jwPassages.filter(
      (resource) => !resource.title.toLowerCase().includes("cars")
    );
    const passageSelections = ResourceSelectionUtils.selectResourcesForSlot(
      anchor,
      "jw_passage",
      2,
      scienceOnlyPassages,
      usedResources,
      remainingTime,
      this.topics,
      sameDayUsed
    );

    for (const selection of passageSelections.slice(0, 2)) {
      if (remainingTime >= selection.time_minutes) {
        blocks.science_passages.push(
          this.convertToResourceItem(selection, anchor)
        );
        remainingTime -= selection.time_minutes;
        sameDayUsed.add(
          ResourceSelectionUtils.getResourceUid(selection.resource)
        );
        await this.resourceManager.markResourceAsUsed(
          selection.resource,
          selection.provider,
          DateUtils.formatDate(date)
        );
      }
    }

    // 2. UWorld: 1 set (10Q)
    const uworldResources = await this.resourceManager.getUWorldResources(
      anchor.key
    );
    const uworldSelections = ResourceSelectionUtils.selectResourcesForSlot(
      anchor,
      "uworld",
      2,
      uworldResources,
      usedResources,
      remainingTime,
      this.topics,
      sameDayUsed
    );

    if (uworldSelections.length > 0) {
      const uworld = uworldSelections[0];
      blocks.uworld_set.push(this.convertToResourceItem(uworld, anchor));
      remainingTime -= uworld.time_minutes;
      sameDayUsed.add(ResourceSelectionUtils.getResourceUid(uworld.resource));
      await this.resourceManager.markResourceAsUsed(
        uworld.resource,
        uworld.provider,
        DateUtils.formatDate(date)
      );
    }

    // 3. Extra discretes: 1-2 discrete sets (NOT used in Phase 1)
    const kaDiscretes = await this.resourceManager.getKhanAcademyResources(
      anchor.key,
      "Discrete Practice Questions"
    );
    const jwDiscretes = await this.resourceManager.getJackWestinResources(
      anchor.key
    );
    const allDiscretes = [...kaDiscretes, ...jwDiscretes];

    // Filter out resources used in Phase 1
    const phase1UnusedDiscretes = allDiscretes.filter(
      (d) => !ResourceSelectionUtils.isUsedInPhase1(d, usedResources)
    );

    const discreteSelections = ResourceSelectionUtils.selectResourcesForSlot(
      anchor,
      "ka_discrete",
      2,
      phase1UnusedDiscretes,
      usedResources,
      remainingTime,
      this.topics,
      sameDayUsed
    );

    for (const selection of discreteSelections.slice(0, 2)) {
      if (remainingTime >= selection.time_minutes) {
        blocks.extra_discretes.push(
          this.convertToResourceItem(selection, anchor)
        );
        remainingTime -= selection.time_minutes;
        sameDayUsed.add(
          ResourceSelectionUtils.getResourceUid(selection.resource)
        );
        await this.resourceManager.markResourceAsUsed(
          selection.resource,
          selection.provider,
          DateUtils.formatDate(date)
        );
      }
    }

    // 4. CARS: 2 Jack Westin passages (Phase 2 uses Jack Westin only)
    // CARS passages are NOT science-based and should be randomly assorted
    const carsPassages = await this.resourceManager.getCarsPassages();
    const carsSelections = ResourceSelectionUtils.selectResourcesForSlot(
      anchor,
      "jw_passage",
      2,
      carsPassages,
      usedResources,
      remainingTime,
      this.topics,
      sameDayUsed
    );

    // Add exactly 2 CARS passages (2x/day as requested)
    for (const selection of carsSelections.slice(0, 2)) {
      if (remainingTime >= selection.time_minutes) {
        blocks.cars.push(this.convertToResourceItem(selection, anchor));
        remainingTime -= selection.time_minutes;
        sameDayUsed.add(
          ResourceSelectionUtils.getResourceUid(selection.resource)
        );
        await this.resourceManager.markResourceAsUsed(
          selection.resource,
          selection.provider,
          DateUtils.formatDate(date)
        );
      }
    }

    // 5. FILL REMAINING TIME: Add more content to reach dynamic target
    const targetTime = this.timeTargets.phase2Target;

    // Aggressively fill remaining time to reach target
    remainingTime = await this.fillRemainingTimePhase2(
      remainingTime,
      targetTime,
      blocks,
      anchor,
      usedResources,
      sameDayUsed,
      date
    );

    blocks.total_resource_minutes = 240 - remainingTime;

    return {
      date: DateUtils.formatDate(date),
      kind: "study",
      phase: 2,
      blocks,
    };
  }

  async planPhase3Day(
    date: Date,
    anchor: Topic,
    usedResources: Set<string>
  ): Promise<ScheduleDay> {
    const blocks: any = {
      aamc_sets: [] as ResourceItem[],
      aamc_CARS_passages: [] as ResourceItem[],
      written_review_minutes: 60,
      total_resource_minutes: 0,
    };

    let remainingTime = 240;
    const sameDayUsed = new Set<string>();

    // Phase 3 Order: AAMC sets → AAMC CARS → Review

    // 1. AAMC sets: 2 × (20-30Q) from different packs
    const aamcSets = await this.resourceManager.getAAMCResources(
      anchor.key,
      "Question Pack"
    );
    // Filter out developer notes from AAMC sets
    const cleanAamcSets = aamcSets.filter(
      (r) =>
        !r.title.includes("This color") &&
        !r.title.includes("developer") &&
        !r.title.includes("note") &&
        // Ensure CARS-labeled packs are not consumed as general sets
        !r.title.includes("CARS") &&
        // Exclude label rows such as the section header
        r.title.trim() !== "Critical Analysis and Reasoning Skills"
    );
    const aamcSetSelections = ResourceSelectionUtils.selectResourcesForSlot(
      anchor,
      "aamc_set",
      3,
      cleanAamcSets,
      usedResources,
      remainingTime,
      this.topics,
      sameDayUsed
    );

    const usedPacks = new Set<string>();
    for (const selection of aamcSetSelections) {
      if (remainingTime >= selection.time_minutes) {
        const packName = (selection.resource as any).pack_name || "Unknown";

        // Ensure different packs unless nothing else available
        if (
          usedPacks.size === 0 ||
          !usedPacks.has(packName) ||
          usedPacks.size === 1
        ) {
          blocks.aamc_sets.push(this.convertToResourceItem(selection, anchor));
          remainingTime -= selection.time_minutes;
          sameDayUsed.add(
            ResourceSelectionUtils.getResourceUid(selection.resource)
          );
          usedPacks.add(packName);
          await this.resourceManager.markResourceAsUsed(
            selection.resource,
            selection.provider,
            DateUtils.formatDate(date)
          );

          if (blocks.aamc_sets.length >= 2) break;
        }
      }
    }

    // 2. AAMC CARS passages: 2 (Phase 3 uses AAMC only)
    const allAamcResources = await this.resourceManager.getAAMCResources(
      anchor.key,
      "Question Pack"
    );
    // Filter out developer notes and get actual CARS passages
    const aamcCars = allAamcResources.filter(
      (r) =>
        r.title.includes("CARS") &&
        !r.title.includes("This color") &&
        !r.title.includes("developer") &&
        !r.title.includes("note") &&
        r.title.trim() !== "Critical Analysis and Reasoning Skills"
    );
    const carsSelections = ResourceSelectionUtils.selectResourcesForSlot(
      anchor,
      "aamc_set",
      3,
      aamcCars,
      usedResources,
      remainingTime,
      this.topics,
      sameDayUsed
    );

    for (const selection of carsSelections.slice(0, 2)) {
      if (remainingTime >= selection.time_minutes) {
        blocks.aamc_CARS_passages.push(
          this.convertToResourceItem(selection, anchor)
        );
        remainingTime -= selection.time_minutes;
        sameDayUsed.add(
          ResourceSelectionUtils.getResourceUid(selection.resource)
        );
        await this.resourceManager.markResourceAsUsed(
          selection.resource,
          selection.provider,
          DateUtils.formatDate(date)
        );
      }
    }

    // 3. FILL REMAINING TIME: Add more AAMC materials to reach dynamic target
    const targetTime = this.timeTargets.phase3Target;

    // Add more AAMC sets (limit to 3 more to ensure variety across days)
    let extraSetsAdded = 0;
    while (
      remainingTime >= 25 &&
      extraSetsAdded < 3 &&
      240 - remainingTime < targetTime
    ) {
      let added = false;
      for (const selection of aamcSetSelections.slice(2 + extraSetsAdded)) {
        if (
          remainingTime >= selection.time_minutes &&
          !sameDayUsed.has(
            ResourceSelectionUtils.getResourceUid(selection.resource)
          )
        ) {
          blocks.aamc_sets.push(this.convertToResourceItem(selection, anchor));
          remainingTime -= selection.time_minutes;
          sameDayUsed.add(
            ResourceSelectionUtils.getResourceUid(selection.resource)
          );
          await this.resourceManager.markResourceAsUsed(
            selection.resource,
            selection.provider,
            DateUtils.formatDate(date)
          );
          extraSetsAdded++;
          added = true;
          break;
        }
      }
      if (!added) break;
    }

    // Add 1 more AAMC CARS if time remains
    if (remainingTime >= 20 && 240 - remainingTime < targetTime) {
      for (const selection of carsSelections.slice(2, 3)) {
        if (
          remainingTime >= selection.time_minutes &&
          !sameDayUsed.has(
            ResourceSelectionUtils.getResourceUid(selection.resource)
          )
        ) {
          blocks.aamc_CARS_passages.push(
            this.convertToResourceItem(selection, anchor)
          );
          remainingTime -= selection.time_minutes;
          sameDayUsed.add(
            ResourceSelectionUtils.getResourceUid(selection.resource)
          );
          await this.resourceManager.markResourceAsUsed(
            selection.resource,
            selection.provider,
            DateUtils.formatDate(date)
          );
          break;
        }
      }
    }

    blocks.total_resource_minutes = 240 - remainingTime;

    return {
      date: DateUtils.formatDate(date),
      kind: "study",
      phase: 3,
      blocks,
    };
  }
}
