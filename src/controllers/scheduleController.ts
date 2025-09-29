import { Request, Response } from 'express';
import { ScheduleGenerator } from '../services/scheduleGenerator';
import { ScheduleRequest } from '../models/types';

export class ScheduleController {
  async getFullPlan(req: Request, res: Response): Promise<void> {
    try {
      // Validate required parameters
      const { start_date, test_date, priorities, availability, fl_weekday } = req.query;
      
      if (!start_date || !test_date || !priorities || !availability || !fl_weekday) {
        res.status(400).json({
          error: 'Missing required parameters',
          required: ['start_date', 'test_date', 'priorities', 'availability', 'fl_weekday']
        });
        return;
      }

      // Validate date format
      const startDate = new Date(start_date as string);
      const testDate = new Date(test_date as string);
      
      if (isNaN(startDate.getTime()) || isNaN(testDate.getTime())) {
        res.status(400).json({
          error: 'Invalid date format. Use YYYY-MM-DD format'
        });
        return;
      }

      if (startDate >= testDate) {
        res.status(400).json({
          error: 'Start date must be before test date'
        });
        return;
      }

      // Validate availability format
      const availabilityArray = (availability as string).split(',').map(a => a.trim());
      const validDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const invalidDays = availabilityArray.filter(day => !validDays.includes(day));
      
      if (invalidDays.length > 0) {
        res.status(400).json({
          error: 'Invalid availability days',
          invalid_days: invalidDays,
          valid_days: validDays
        });
        return;
      }

      // Validate fl_weekday
      if (!validDays.includes(fl_weekday as string)) {
        res.status(400).json({
          error: 'Invalid full length weekday',
          valid_days: validDays
        });
        return;
      }

      // Generate schedule
      const scheduleRequest: ScheduleRequest = {
        start_date: start_date as string,
        test_date: test_date as string,
        priorities: priorities as string,
        availability: availability as string,
        fl_weekday: fl_weekday as string
      };

      const scheduleId = `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const generator = new ScheduleGenerator(scheduleId);
      const schedule = await generator.generateSchedule(scheduleRequest);

      res.json(schedule);
    } catch (error) {
      console.error('Error generating schedule:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getHealth(req: Request, res: Response): Promise<void> {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'MCAT Study Schedule Planner'
    });
  }
}
