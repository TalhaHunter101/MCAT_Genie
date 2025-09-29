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
    
    // Calculate phases
    const phaseInfo = DateUtils.calculatePhaseInfo(studyDates.length);
    
    // Get full length dates
    const flDates = DateUtils.distributeFullLengths(startDate, testDate, flWeekday, 6);
    
    // Get topics by priority
    const topics = await this.resourceManager.getTopicsByPriority(priorities);
    const highYieldTopics = topics.filter(t => t.high_yield);
    
    // Generate schedule
    const schedule: ScheduleDay[] = [];
    let studyDayIndex = 0;
    let currentTopicIndex = 0;
    const usedResources = await this.resourceManager.getUsedResources();

    for (const date of allDates) {
      if (DateUtils.isStudyDay(date, availability)) {
        // Check if it's a full length day
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
        } else {
          // Regular study day
          const phase = DateUtils.getPhaseForDay(studyDayIndex, phaseInfo);
          const anchor = this.selectAnchor(highYieldTopics, currentTopicIndex, phase);
          
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
          currentTopicIndex = (currentTopicIndex + 1) % highYieldTopics.length;
        }
        
        studyDayIndex++;
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

  private selectAnchor(topics: Topic[], currentIndex: number, phase: number): Topic {
    // For Phase 1 & 2, prefer high-yield topics
    // For Phase 3, can use any topic
    if (phase <= 2) {
      const hyTopics = topics.filter(t => t.high_yield);
      if (hyTopics.length > 0) {
        return hyTopics[currentIndex % hyTopics.length];
      }
    }
    
    return topics[currentIndex % topics.length];
  }
}
