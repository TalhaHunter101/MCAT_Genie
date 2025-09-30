import { ResourceManager } from './resourceManager';
import { PhasePlanner } from './phasePlanner';
import { ScheduleRequest, ScheduleResponse, ScheduleDay, Topic } from '../models/types';
import { DateUtils } from '../utils/dateUtils';

export class ScheduleGenerator {
  private resourceManager: ResourceManager;
  private phasePlanner: PhasePlanner;
  private scheduleId: string;

  constructor(scheduleId: string) {
    this.scheduleId = scheduleId;
    this.resourceManager = new ResourceManager(scheduleId);
    this.phasePlanner = new PhasePlanner(this.resourceManager);
  }

  async generateSchedule(request: ScheduleRequest): Promise<ScheduleResponse> {
    const startDate = DateUtils.parseDate(request.start_date);
    const testDate = DateUtils.parseDate(request.test_date);
    const availability = request.availability.split(',').map(a => a.trim());
    const priorities = request.priorities.split(',').map(p => p.trim());
    const flWeekday = request.fl_weekday;

    // Generate calendar
    const allDates = DateUtils.generateDateRange(startDate, testDate);
    const studyDates = allDates.filter(date => DateUtils.isStudyDay(date, availability));
    
    // Get full length dates
    const flDates = DateUtils.distributeFullLengths(startDate, testDate, flWeekday, 6);
    
    // Calculate phases - exclude FL days from study day count
    // FL days are scheduled separately and don't count toward phase distribution
    const actualStudyDays = studyDates.length - flDates.filter(flDate => 
      studyDates.some(studyDate => 
        DateUtils.formatDate(flDate) === DateUtils.formatDate(studyDate)
      )
    ).length;
    const phaseInfo = DateUtils.calculatePhaseInfo(actualStudyDays);
    
    // Get topics by priority
    const topics = await this.resourceManager.getTopicsByPriority(priorities);
    const highYieldTopics = topics.filter(t => t.high_yield);
    
    // Calculate dynamic time targets based on study duration
    const timeTargets = DateUtils.calculateTimeTargets(phaseInfo.phase1 + phaseInfo.phase2 + phaseInfo.phase3);
    
    // Initialize phase planner with topics and time targets
    await this.phasePlanner.initialize(topics, timeTargets);
    
    // Generate schedule
    const schedule: ScheduleDay[] = [];
    let studyDayIndex = 0;
    let currentTopicIndex = 0;

    for (const date of allDates) {
      // Check if it's a full length day FIRST (before checking study day)
      const isFLDay = flDates.some(flDate => 
        flDate.getTime() === date.getTime()
      );

      if (isFLDay) {
        const flIndex = flDates.findIndex(flDate => 
          flDate.getTime() === date.getTime()
        );
        schedule.push({
          date: DateUtils.formatDate(date),
          kind: 'full_length',
          provider: 'AAMC',
          name: `FL #${flIndex + 1}`
        });
      } else if (DateUtils.isStudyDay(date, availability)) {
        // Regular study day
        // CRITICAL FIX: Refresh used resources from DB before each day
        const usedResources = await this.resourceManager.getUsedResources();
        
        const phase = DateUtils.getPhaseForDay(studyDayIndex, phaseInfo);
        const anchor = this.selectAnchor(topics, currentTopicIndex, phase, priorities);
        
        let studyDay: ScheduleDay;
        switch (phase) {
          case 1:
            studyDay = await this.phasePlanner.planPhase1Day(date, anchor, usedResources);
            break;
          case 2:
            studyDay = await this.phasePlanner.planPhase2Day(date, anchor, usedResources);
            break;
          case 3:
            studyDay = await this.phasePlanner.planPhase3Day(date, anchor, usedResources);
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
          kind: 'break'
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
      full_length_days: flDates.length
    };

    return {
      schedule,
      metadata
    };
  }

  private selectAnchor(topics: Topic[], currentIndex: number, phase: number, priorities: string[]): Topic {
    // For Phase 1 & 2, prioritize high-yield but rotate across categories
    // For Phase 3, can use any topic
    if (phase <= 2) {
      const hyTopics = topics.filter(t => t.high_yield);
      if (hyTopics.length > 0) {
        // Rotate through priority categories to avoid exhausting one category's resources
        // Group topics by category
        const categoryGroups: Record<string, Topic[]> = {};
        for (const topic of hyTopics) {
          const category = topic.key.split('.')[0];
          if (priorities.includes(category)) {
            if (!categoryGroups[category]) {
              categoryGroups[category] = [];
            }
            categoryGroups[category].push(topic);
          }
        }
        
        // Select category in round-robin fashion based on currentIndex
        const availableCategories = priorities.filter(p => categoryGroups[p] && categoryGroups[p].length > 0);
        if (availableCategories.length > 0) {
          const categoryIndex = currentIndex % availableCategories.length;
          const selectedCategory = availableCategories[categoryIndex];
          const categoryTopics = categoryGroups[selectedCategory];
          const topicIndex = Math.floor(currentIndex / availableCategories.length) % categoryTopics.length;
          return categoryTopics[topicIndex];
        }
        
        // Fallback to any high-yield topic
        return hyTopics[currentIndex % hyTopics.length];
      }
    }
    
    return topics[currentIndex % topics.length];
  }
}
