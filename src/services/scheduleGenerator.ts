import { ResourceManager } from "./resourceManager";
import { PhasePlanner } from "./phasePlanner";
import {
  ScheduleRequest,
  ScheduleResponse,
  ScheduleDay,
  Topic,
} from "../models/types";
import { DateUtils } from "../utils/dateUtils";

export class ScheduleGenerator {
  private resourceManager: ResourceManager;
  private phasePlanner: PhasePlanner;
  private scheduleId: string;
  private categoryPointers: Record<string, number> = {};

  constructor(scheduleId: string) {
    this.scheduleId = scheduleId;
    this.resourceManager = new ResourceManager(scheduleId);
    this.phasePlanner = new PhasePlanner(this.resourceManager);
  }

  async generateSchedule(request: ScheduleRequest): Promise<ScheduleResponse> {
    const startDate = DateUtils.parseDate(request.start_date);
    const testDate = DateUtils.parseDate(request.test_date);
    const availability = request.availability.split(",").map((a) => a.trim());
    const priorities = request.priorities.split(",").map((p) => p.trim());
    const flWeekday = request.fl_weekday;

    // Generate calendar
    const allDates = DateUtils.generateDateRange(startDate, testDate);
    const studyDates = allDates.filter((date) =>
      DateUtils.isStudyDay(date, availability)
    );

    // Get full length dates
    const flDates = DateUtils.distributeFullLengths(
      startDate,
      testDate,
      flWeekday,
      6
    );

    // Calculate phases - exclude FL days from study day count
    // FL days are scheduled separately and don't count toward phase distribution
    const actualStudyDays =
      studyDates.length -
      flDates.filter((flDate) =>
        studyDates.some(
          (studyDate) =>
            DateUtils.formatDate(flDate) === DateUtils.formatDate(studyDate)
        )
      ).length;
    const phaseInfo = DateUtils.calculatePhaseInfo(actualStudyDays);

    // Get topics by priority
    const topics = await this.resourceManager.getTopicsByPriority(priorities);
    const highYieldTopics = topics.filter((t) => t.high_yield);

    // Calculate dynamic time targets based on study duration
    const timeTargets = DateUtils.calculateTimeTargets(
      phaseInfo.phase1 + phaseInfo.phase2 + phaseInfo.phase3
    );

    // Initialize phase planner with topics and time targets
    await this.phasePlanner.initialize(topics, timeTargets);

    // Generate schedule
    const schedule: ScheduleDay[] = [];
    let studyDayIndex = 0;
    let currentTopicIndex = 0;

    for (const date of allDates) {
      // Check if it's a full length day FIRST (before checking study day)
      const isFLDay = flDates.some(
        (flDate) => flDate.getTime() === date.getTime()
      );

      if (isFLDay) {
        const flIndex = flDates.findIndex(
          (flDate) => flDate.getTime() === date.getTime()
        );
        schedule.push({
          date: DateUtils.formatDate(date),
          kind: "full_length",
          provider: "AAMC",
          name: `FL #${flIndex + 1}`,
        });
      } else if (DateUtils.isStudyDay(date, availability)) {
        // Regular study day
        // CRITICAL FIX: Refresh used resources from DB before each day
        const usedResources = await this.resourceManager.getUsedResources();

        const phase = DateUtils.getPhaseForDay(studyDayIndex, phaseInfo);
        const anchor = await this.selectAnchor(
          topics,
          currentTopicIndex,
          phase,
          priorities,
          usedResources
        );

        let studyDay: ScheduleDay;
        switch (phase) {
          case 1:
            studyDay = await this.phasePlanner.planPhase1Day(
              date,
              anchor,
              usedResources
            );
            break;
          case 2:
            studyDay = await this.phasePlanner.planPhase2Day(
              date,
              anchor,
              usedResources
            );
            break;
          case 3:
            studyDay = await this.phasePlanner.planPhase3Day(
              date,
              anchor,
              usedResources
            );
            break;
          default:
            throw new Error(`Invalid phase: ${phase}`);
        }

        schedule.push(studyDay);
        studyDayIndex++;
        currentTopicIndex = (currentTopicIndex + 1) % topics.length;
      } else {
        // Break day
        schedule.push({
          date: DateUtils.formatDate(date),
          kind: "break",
        });
      }
    }

    // Calculate metadata
    const metadata = {
      total_days: allDates.length,
      study_days: studyDates.length,
      break_days: allDates.length - studyDates.length,
      phase_1_days: phaseInfo.phase1,
      phase_2_days: phaseInfo.phase2,
      phase_3_days: phaseInfo.phase3,
      full_length_days: flDates.length,
    };

    return {
      schedule,
      metadata,
    };
  }

  private async selectAnchor(
    topics: Topic[],
    currentIndex: number,
    phase: number,
    priorities: string[],
    usedResources: Set<string>
  ): Promise<Topic> {
    if (phase <= 2) {
      const hyTopics = topics.filter((t) => t.high_yield);
      if (hyTopics.length > 0) {
        const categoryGroups: Record<string, Topic[]> = {};
        for (const topic of hyTopics) {
          const category = topic.key.split(".")[0];
          if (priorities.includes(category)) {
            if (!categoryGroups[category]) {
              categoryGroups[category] = [];
            }
            categoryGroups[category].push(topic);
          }
        }

        const availableCategories = priorities.filter(
          (p) => categoryGroups[p] && categoryGroups[p].length > 0
        );
        if (availableCategories.length > 0) {
          const categoryIndex = currentIndex % availableCategories.length;
          const selectedCategory = availableCategories[categoryIndex];
          const categoryTopics = categoryGroups[selectedCategory];

          if (!this.categoryPointers[selectedCategory]) {
            this.categoryPointers[selectedCategory] = 0;
          }

          let attempts = 0;
          let topicIndex =
            this.categoryPointers[selectedCategory] % categoryTopics.length;

          while (attempts < categoryTopics.length) {
            const candidateAnchor = categoryTopics[topicIndex];

            const hasSupply = await this.checkAnchorHasSupply(
              candidateAnchor,
              phase,
              usedResources
            );

            if (hasSupply) {
              this.categoryPointers[selectedCategory] =
                (topicIndex + 1) % categoryTopics.length;
              return candidateAnchor;
            }

            topicIndex = (topicIndex + 1) % categoryTopics.length;
            attempts++;
          }

          this.categoryPointers[selectedCategory] =
            (topicIndex + 1) % categoryTopics.length;
          return categoryTopics[topicIndex];
        }

        return hyTopics[currentIndex % hyTopics.length];
      }
    }

    return topics[currentIndex % topics.length];
  }

  private async checkAnchorHasSupply(
    anchor: Topic,
    phase: number,
    usedResources: Set<string>
  ): Promise<boolean> {
    if (phase === 1) {
      const kaplanResources = await this.resourceManager.getKaplanResources(
        anchor.key,
        true
      );
      const kaplanUnused = kaplanResources.filter((r) => {
        const uid = r.stable_id || `${r.title.toLowerCase().trim()}+${r.key}`;
        return !usedResources.has(uid);
      });

      if (kaplanUnused.length > 0) return true;

      const kaDiscretes = await this.resourceManager.getKhanAcademyResources(
        anchor.key,
        "Discrete Practice Questions"
      );
      const discretesUnused = kaDiscretes.filter((r) => {
        const uid = r.stable_id || `${r.title.toLowerCase().trim()}+${r.key}`;
        return !usedResources.has(uid);
      });

      if (discretesUnused.length > 0) return true;

      const kaplanLowYield = await this.resourceManager.getKaplanResources(
        anchor.key,
        false
      );
      const kaplanLYUnused = kaplanLowYield.filter((r) => {
        const uid = r.stable_id || `${r.title.toLowerCase().trim()}+${r.key}`;
        return !usedResources.has(uid);
      });

      return kaplanLYUnused.length > 0;
    }

    if (phase === 2) {
      const jwPassages = await this.resourceManager.getJackWestinResources(
        anchor.key
      );
      const sciencePassages = jwPassages.filter(
        (resource) => !resource.title.toLowerCase().includes("cars")
      );
      const passagesUnused = sciencePassages.filter((r) => {
        const uid = r.stable_id || `${r.title.toLowerCase().trim()}+${r.key}`;
        return !usedResources.has(uid);
      });

      if (passagesUnused.length > 0) return true;

      const uworldResources = await this.resourceManager.getUWorldResources(
        anchor.key
      );
      if (uworldResources.length > 0) return true;

      return false;
    }

    return true;
  }
}
