import { ResourceManager } from './resourceManager';
import { Topic, ScheduleDay, ResourceSelection, Resource } from '../models/types';
import { DateUtils } from '../utils/dateUtils';
import { ResourceSelectionUtils } from '../utils/resourceSelectionUtils';

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
    strategy: 'balanced'
  };

  constructor(resourceManager: ResourceManager) {
    this.resourceManager = resourceManager;
  }

  async initialize(topics: Topic[], timeTargets?: {
    phase1Target: number;
    phase2Target: number;
    phase3Target: number;
    strategy: string;
  }): Promise<void> {
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
      science_content: [],
      science_discretes: [],
      cars: [],
      written_review_minutes: 60,
      total_resource_minutes: 0
    };

    let remainingTime = 240; // 4 hours in minutes
    const sameDayUsed = new Set<string>();

    // Phase 1 Goal: Always pair Kaplan with matching KA content
    // Order: Science content → Science discretes → CARS → Review

    // 1. Science content: 1 Kaplan section + matching KA content (videos + articles)
    const kaplanResources = await this.resourceManager.getKaplanResources(anchor.key, true);
    const kaVideos = await this.resourceManager.getKhanAcademyResources(anchor.key, 'Videos');
    const kaArticles = await this.resourceManager.getKhanAcademyResources(anchor.key, 'Articles');

    // Select Kaplan section with high-yield priority
    const kaplanSelections = ResourceSelectionUtils.selectResourcesForSlot(
      anchor, 'kaplan', 1, kaplanResources, usedResources, remainingTime, this.topics, sameDayUsed
    );

    if (kaplanSelections.length > 0) {
      const kaplan = kaplanSelections[0];
      blocks.science_content.push(kaplan.resource.title);
      remainingTime -= kaplan.time_minutes;
      sameDayUsed.add(ResourceSelectionUtils.getResourceUid(kaplan.resource));
      await this.resourceManager.markResourceAsUsed(kaplan.resource, kaplan.provider, DateUtils.formatDate(date));
    }

    // Add matching KA content (videos + articles)
    const kaVideoSelections = ResourceSelectionUtils.selectResourcesForSlot(
      anchor, 'ka_video', 1, kaVideos, usedResources, remainingTime, this.topics, sameDayUsed
    );

    for (const selection of kaVideoSelections.slice(0, 2)) {
      if (remainingTime >= selection.time_minutes) {
        blocks.science_content.push(selection.resource.title);
        remainingTime -= selection.time_minutes;
        sameDayUsed.add(ResourceSelectionUtils.getResourceUid(selection.resource));
        await this.resourceManager.markResourceAsUsed(selection.resource, selection.provider, DateUtils.formatDate(date));
      }
    }

    const kaArticleSelections = ResourceSelectionUtils.selectResourcesForSlot(
      anchor, 'ka_article', 1, kaArticles, usedResources, remainingTime, this.topics, sameDayUsed
    );

    for (const selection of kaArticleSelections.slice(0, 1)) {
      if (remainingTime >= selection.time_minutes) {
        blocks.science_content.push(selection.resource.title);
        remainingTime -= selection.time_minutes;
        sameDayUsed.add(ResourceSelectionUtils.getResourceUid(selection.resource));
        await this.resourceManager.markResourceAsUsed(selection.resource, selection.provider, DateUtils.formatDate(date));
      }
    }

    // 2. Science discretes: 1 KA or Jack Westin discrete set
    const kaDiscretes = await this.resourceManager.getKhanAcademyResources(anchor.key, 'Discrete Practice Questions');
    const jwDiscretes = await this.resourceManager.getJackWestinResources(anchor.key);
    const allDiscretes = [...kaDiscretes, ...jwDiscretes];

    const discreteSelections = ResourceSelectionUtils.selectResourcesForSlot(
      anchor, 'ka_discrete', 1, allDiscretes, usedResources, remainingTime, this.topics, sameDayUsed
    );

    if (discreteSelections.length > 0) {
      const discrete = discreteSelections[0];
      blocks.science_discretes.push(discrete.resource.title);
      remainingTime -= discrete.time_minutes;
      sameDayUsed.add(ResourceSelectionUtils.getResourceUid(discrete.resource));
      await this.resourceManager.markResourceAsUsed(discrete.resource, discrete.provider, DateUtils.formatDate(date));
    }

    // 3. CARS: 2 Jack Westin passages (Phase 1 uses Jack Westin only)
    // CARS passages are NOT science-based and should be randomly assorted
    const carsPassages = await this.resourceManager.getCarsPassages();
    const carsSelections = ResourceSelectionUtils.selectResourcesForSlot(
      anchor, 'jw_passage', 2, carsPassages, usedResources, remainingTime, this.topics, sameDayUsed
    );

    for (const selection of carsSelections.slice(0, 2)) {
      if (remainingTime >= selection.time_minutes) {
        blocks.cars.push(selection.resource.title);
        remainingTime -= selection.time_minutes;
        sameDayUsed.add(ResourceSelectionUtils.getResourceUid(selection.resource));
        await this.resourceManager.markResourceAsUsed(selection.resource, selection.provider, DateUtils.formatDate(date));
      }
    }

    // 4. FILL REMAINING TIME: Add more content to reach dynamic target
    // Dynamic target based on study duration strategy
    const targetTime = this.timeTargets.phase1Target;
    
    // Add more KA videos if time remains (limit to 2 more)
    let extraVideosAdded = 0;
    while (remainingTime >= 10 && extraVideosAdded < 2 && (240 - remainingTime) < targetTime) {
      let added = false;
      for (const selection of kaVideoSelections.slice(2 + extraVideosAdded)) {
        if (remainingTime >= selection.time_minutes && 
            !sameDayUsed.has(ResourceSelectionUtils.getResourceUid(selection.resource))) {
          blocks.science_content.push(selection.resource.title);
          remainingTime -= selection.time_minutes;
          sameDayUsed.add(ResourceSelectionUtils.getResourceUid(selection.resource));
          await this.resourceManager.markResourceAsUsed(selection.resource, selection.provider, DateUtils.formatDate(date));
          extraVideosAdded++;
          added = true;
          break;
        }
      }
      if (!added) break;
    }

    // Add more KA articles if time remains (limit to 1 more)
    if (remainingTime >= 8 && (240 - remainingTime) < targetTime) {
      for (const selection of kaArticleSelections.slice(1, 2)) {
        if (remainingTime >= selection.time_minutes && 
            !sameDayUsed.has(ResourceSelectionUtils.getResourceUid(selection.resource))) {
          blocks.science_content.push(selection.resource.title);
          remainingTime -= selection.time_minutes;
          sameDayUsed.add(ResourceSelectionUtils.getResourceUid(selection.resource));
          await this.resourceManager.markResourceAsUsed(selection.resource, selection.provider, DateUtils.formatDate(date));
          break;
        }
      }
    }

    // Add more discrete sets if time remains (limit to 2 more)
    let extraDiscretesAdded = 0;
    while (remainingTime >= 25 && extraDiscretesAdded < 2 && (240 - remainingTime) < targetTime) {
      let added = false;
      for (const selection of discreteSelections.slice(1 + extraDiscretesAdded)) {
        if (remainingTime >= selection.time_minutes && 
            !sameDayUsed.has(ResourceSelectionUtils.getResourceUid(selection.resource))) {
          blocks.science_discretes.push(selection.resource.title);
          remainingTime -= selection.time_minutes;
          sameDayUsed.add(ResourceSelectionUtils.getResourceUid(selection.resource));
          await this.resourceManager.markResourceAsUsed(selection.resource, selection.provider, DateUtils.formatDate(date));
          extraDiscretesAdded++;
          added = true;
          break;
        }
      }
      if (!added) break;
    }

    // DON'T add more CARS in Phase 1 - preserve for Phase 2

    blocks.total_resource_minutes = 240 - remainingTime;

    return {
      date: DateUtils.formatDate(date),
      kind: 'study',
      phase: 1,
      blocks
    };
  }

  async planPhase2Day(
    date: Date,
    anchor: Topic,
    usedResources: Set<string>
  ): Promise<ScheduleDay> {
    const blocks: any = {
      science_passages: [],
      uworld_set: [],
      extra_discretes: [],
      cars: [],
      written_review_minutes: 60,
      total_resource_minutes: 0
    };

    let remainingTime = 240;
    const sameDayUsed = new Set<string>();

    // Phase 2 Order: Science passages → UWorld → Extra discretes → CARS → Review

    // 1. Science passages: 2 third-party (same category/subtopic as anchor OK)
    const jwPassages = await this.resourceManager.getJackWestinResources(anchor.key);
    // Filter out CARS passages for science passages
    const scienceOnlyPassages = jwPassages.filter(resource => 
      !resource.title.toLowerCase().includes('cars')
    );
    const passageSelections = ResourceSelectionUtils.selectResourcesForSlot(
      anchor, 'jw_passage', 2, scienceOnlyPassages, usedResources, remainingTime, this.topics, sameDayUsed
    );

    for (const selection of passageSelections.slice(0, 2)) {
      if (remainingTime >= selection.time_minutes) {
        blocks.science_passages.push(selection.resource.title);
        remainingTime -= selection.time_minutes;
        sameDayUsed.add(ResourceSelectionUtils.getResourceUid(selection.resource));
        await this.resourceManager.markResourceAsUsed(selection.resource, selection.provider, DateUtils.formatDate(date));
      }
    }

    // 2. UWorld: 1 set (10Q)
    const uworldResources = await this.resourceManager.getUWorldResources(anchor.key);
    const uworldSelections = ResourceSelectionUtils.selectResourcesForSlot(
      anchor, 'uworld', 2, uworldResources, usedResources, remainingTime, this.topics, sameDayUsed
    );

    if (uworldSelections.length > 0) {
      const uworld = uworldSelections[0];
      blocks.uworld_set.push(uworld.resource.title);
      remainingTime -= uworld.time_minutes;
      sameDayUsed.add(ResourceSelectionUtils.getResourceUid(uworld.resource));
      await this.resourceManager.markResourceAsUsed(uworld.resource, uworld.provider, DateUtils.formatDate(date));
    }

    // 3. Extra discretes: 1-2 discrete sets (NOT used in Phase 1)
    const kaDiscretes = await this.resourceManager.getKhanAcademyResources(anchor.key, 'Discrete Practice Questions');
    const jwDiscretes = await this.resourceManager.getJackWestinResources(anchor.key);
    const allDiscretes = [...kaDiscretes, ...jwDiscretes];

    // Filter out resources used in Phase 1
    const phase1UnusedDiscretes = allDiscretes.filter(d => 
      !ResourceSelectionUtils.isUsedInPhase1(d, usedResources)
    );

    const discreteSelections = ResourceSelectionUtils.selectResourcesForSlot(
      anchor, 'ka_discrete', 2, phase1UnusedDiscretes, usedResources, remainingTime, this.topics, sameDayUsed
    );

    for (const selection of discreteSelections.slice(0, 2)) {
      if (remainingTime >= selection.time_minutes) {
        blocks.extra_discretes.push(selection.resource.title);
        remainingTime -= selection.time_minutes;
        sameDayUsed.add(ResourceSelectionUtils.getResourceUid(selection.resource));
        await this.resourceManager.markResourceAsUsed(selection.resource, selection.provider, DateUtils.formatDate(date));
      }
    }

    // 4. CARS: 2 Jack Westin passages (Phase 2 uses Jack Westin only)
    // CARS passages are NOT science-based and should be randomly assorted
    const carsPassages = await this.resourceManager.getCarsPassages();
    const carsSelections = ResourceSelectionUtils.selectResourcesForSlot(
      anchor, 'jw_passage', 2, carsPassages, usedResources, remainingTime, this.topics, sameDayUsed
    );

    // Add exactly 2 CARS passages (2x/day as requested)
    for (const selection of carsSelections.slice(0, 2)) {
      if (remainingTime >= selection.time_minutes) {
        blocks.cars.push(selection.resource.title);
        remainingTime -= selection.time_minutes;
        sameDayUsed.add(ResourceSelectionUtils.getResourceUid(selection.resource));
        await this.resourceManager.markResourceAsUsed(selection.resource, selection.provider, DateUtils.formatDate(date));
      }
    }

    // 5. FILL REMAINING TIME: Add more content to reach dynamic target
    const targetTime = this.timeTargets.phase2Target;
    
    // Add 1 more passage if time remains
    if (remainingTime >= 20 && (240 - remainingTime) < targetTime) {
      for (const selection of passageSelections.slice(2, 3)) {
        if (remainingTime >= selection.time_minutes && 
            !sameDayUsed.has(ResourceSelectionUtils.getResourceUid(selection.resource))) {
          blocks.science_passages.push(selection.resource.title);
          remainingTime -= selection.time_minutes;
          sameDayUsed.add(ResourceSelectionUtils.getResourceUid(selection.resource));
          await this.resourceManager.markResourceAsUsed(selection.resource, selection.provider, DateUtils.formatDate(date));
          break;
        }
      }
    }

    // DON'T add more CARS - client wants exactly 2x/day

    // Add 1 more discrete if time remains
    if (remainingTime >= 25 && (240 - remainingTime) < targetTime) {
      for (const selection of discreteSelections.slice(2, 3)) {
        if (remainingTime >= selection.time_minutes && 
            !sameDayUsed.has(ResourceSelectionUtils.getResourceUid(selection.resource))) {
          blocks.extra_discretes.push(selection.resource.title);
          remainingTime -= selection.time_minutes;
          sameDayUsed.add(ResourceSelectionUtils.getResourceUid(selection.resource));
          await this.resourceManager.markResourceAsUsed(selection.resource, selection.provider, DateUtils.formatDate(date));
          break;
        }
      }
    }

    blocks.total_resource_minutes = 240 - remainingTime;

    return {
      date: DateUtils.formatDate(date),
      kind: 'study',
      phase: 2,
      blocks
    };
  }

  async planPhase3Day(
    date: Date,
    anchor: Topic,
    usedResources: Set<string>
  ): Promise<ScheduleDay> {
    const blocks: any = {
      aamc_sets: [],
      aamc_CARS_passages: [],
      written_review_minutes: 60,
      total_resource_minutes: 0
    };

    let remainingTime = 240;
    const sameDayUsed = new Set<string>();

    // Phase 3 Order: AAMC sets → AAMC CARS → Review

    // 1. AAMC sets: 2 × (20-30Q) from different packs
    const aamcSets = await this.resourceManager.getAAMCResources(anchor.key, 'Question Pack');
    // Filter out developer notes from AAMC sets
    const cleanAamcSets = aamcSets.filter(r => 
      !r.title.includes('This color') && 
      !r.title.includes('developer') &&
      !r.title.includes('note') &&
      // Ensure CARS-labeled packs are not consumed as general sets
      !r.title.includes('CARS') &&
      // Exclude label rows such as the section header
      r.title.trim() !== 'Critical Analysis and Reasoning Skills'
    );
    const aamcSetSelections = ResourceSelectionUtils.selectResourcesForSlot(
      anchor, 'aamc_set', 3, cleanAamcSets, usedResources, remainingTime, this.topics, sameDayUsed
    );

    const usedPacks = new Set<string>();
    for (const selection of aamcSetSelections) {
      if (remainingTime >= selection.time_minutes) {
        const packName = (selection.resource as any).pack_name || 'Unknown';
        
        // Ensure different packs unless nothing else available
        if (usedPacks.size === 0 || !usedPacks.has(packName) || usedPacks.size === 1) {
          blocks.aamc_sets.push(selection.resource.title);
          remainingTime -= selection.time_minutes;
          sameDayUsed.add(ResourceSelectionUtils.getResourceUid(selection.resource));
          usedPacks.add(packName);
          await this.resourceManager.markResourceAsUsed(selection.resource, selection.provider, DateUtils.formatDate(date));
          
          if (blocks.aamc_sets.length >= 2) break;
        }
      }
    }

    // 2. AAMC CARS passages: 2 (Phase 3 uses AAMC only)
    const allAamcResources = await this.resourceManager.getAAMCResources(anchor.key, 'Question Pack');
    // Filter out developer notes and get actual CARS passages
    const aamcCars = allAamcResources.filter(r => 
      r.title.includes('CARS') && 
      !r.title.includes('This color') && 
      !r.title.includes('developer') &&
      !r.title.includes('note') &&
      r.title.trim() !== 'Critical Analysis and Reasoning Skills'
    );
    const carsSelections = ResourceSelectionUtils.selectResourcesForSlot(
      anchor, 'aamc_set', 3, aamcCars, usedResources, remainingTime, this.topics, sameDayUsed
    );

    for (const selection of carsSelections.slice(0, 2)) {
      if (remainingTime >= selection.time_minutes) {
        blocks.aamc_CARS_passages.push(selection.resource.title);
        remainingTime -= selection.time_minutes;
        sameDayUsed.add(ResourceSelectionUtils.getResourceUid(selection.resource));
        await this.resourceManager.markResourceAsUsed(selection.resource, selection.provider, DateUtils.formatDate(date));
      }
    }

    // 3. FILL REMAINING TIME: Add more AAMC materials to reach dynamic target
    const targetTime = this.timeTargets.phase3Target;
    
    // Add more AAMC sets (limit to 3 more to ensure variety across days)
    let extraSetsAdded = 0;
    while (remainingTime >= 25 && extraSetsAdded < 3 && (240 - remainingTime) < targetTime) {
      let added = false;
      for (const selection of aamcSetSelections.slice(2 + extraSetsAdded)) {
        if (remainingTime >= selection.time_minutes && 
            !sameDayUsed.has(ResourceSelectionUtils.getResourceUid(selection.resource))) {
          blocks.aamc_sets.push(selection.resource.title);
          remainingTime -= selection.time_minutes;
          sameDayUsed.add(ResourceSelectionUtils.getResourceUid(selection.resource));
          await this.resourceManager.markResourceAsUsed(selection.resource, selection.provider, DateUtils.formatDate(date));
          extraSetsAdded++;
          added = true;
          break;
        }
      }
      if (!added) break;
    }

    // Add 1 more AAMC CARS if time remains
    if (remainingTime >= 20 && (240 - remainingTime) < targetTime) {
      for (const selection of carsSelections.slice(2, 3)) {
        if (remainingTime >= selection.time_minutes && 
            !sameDayUsed.has(ResourceSelectionUtils.getResourceUid(selection.resource))) {
          blocks.aamc_CARS_passages.push(selection.resource.title);
          remainingTime -= selection.time_minutes;
          sameDayUsed.add(ResourceSelectionUtils.getResourceUid(selection.resource));
          await this.resourceManager.markResourceAsUsed(selection.resource, selection.provider, DateUtils.formatDate(date));
          break;
        }
      }
    }

    blocks.total_resource_minutes = 240 - remainingTime;

    return {
      date: DateUtils.formatDate(date),
      kind: 'study',
      phase: 3,
      blocks
    };
  }

}
