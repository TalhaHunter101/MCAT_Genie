import { Request, Response } from 'express';
import { ScheduleGenerator } from '../services/scheduleGenerator';
import { ScheduleRequest } from '../models/types';

/**
 * @swagger
 * components:
 *   schemas:
 *     ScheduleRequest:
 *       type: 'object'
 *       required:
 *         - start_date
 *         - test_date
 *         - priorities
 *         - availability
 *         - fl_weekday
 *       properties:
 *         start_date:
 *           type: 'string'
 *           format: 'date'
 *           example: '2025-10-06'
 *           description: 'First study day in YYYY-MM-DD format'
 *         test_date:
 *           type: 'string'
 *           format: 'date'
 *           example: '2025-12-15'
 *           description: 'MCAT exam date in YYYY-MM-DD format'
 *         priorities:
 *           type: 'string'
 *           example: '1A,1B,1D,3A,3B,4A,4B,5A,5D,5E,6B,7A,9B'
 *           description: 'Comma-separated list of content categories in priority order'
 *         availability:
 *           type: 'string'
 *           example: 'Mon,Tue,Thu,Fri,Sat'
 *           description: 'Comma-separated list of study days'
 *         fl_weekday:
 *           type: 'string'
 *           example: 'Sat'
 *           description: 'Day of week for full-length exams'
 */

export class ScheduleController {
  /**
   * @swagger
   * /full-plan:
   *   get:
   *     summary: Generate a personalized MCAT study schedule
   *     description: Creates a comprehensive study schedule from start date to exam day, respecting availability and content priorities
   *     tags: [Schedule]
   *     parameters:
   *       - in: query
   *         name: start_date
   *         required: true
   *         schema:
   *           type: string
   *           format: date
   *         example: '2025-10-06'
   *         description: First study day in YYYY-MM-DD format
   *       - in: query
   *         name: test_date
   *         required: true
   *         schema:
   *           type: string
   *           format: date
   *         example: '2025-12-15'
   *         description: MCAT exam date in YYYY-MM-DD format
   *       - in: query
   *         name: priorities
   *         required: true
   *         schema:
   *           type: string
   *         example: '1A,1B,1D,3A,3B,4A,4B,5A,5D,5E,6B,7A,9B'
   *         description: Comma-separated list of content categories in priority order
   *       - in: query
   *         name: availability
   *         required: true
   *         schema:
   *           type: string
   *         example: 'Mon,Tue,Thu,Fri,Sat'
   *         description: Comma-separated list of study days
   *       - in: query
   *         name: fl_weekday
   *         required: true
   *         schema:
   *           type: string
   *         example: 'Sat'
   *         description: Day of week for full-length exams
   *     responses:
   *       200:
   *         description: Successfully generated study schedule
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ScheduleResponse'
   *             examples:
   *               example1:
   *                 summary: 10-week study plan
   *                 value:
   *                   schedule:
   *                     - date: '2025-10-06'
   *                       kind: 'break'
   *                     - date: '2025-10-07'
   *                       kind: 'study'
   *                       phase: 1
   *                       blocks:
   *                         science_content: ['Kaplan Section Title', 'KA Video Title']
   *                         science_discretes: ['KA Discrete Set']
   *                         cars: ['JW Passage 1', 'JW Passage 2']
   *                         written_review_minutes: 60
   *                         total_resource_minutes: 240
   *                   metadata:
   *                     total_days: 70
   *                     study_days: 50
   *                     break_days: 20
   *                     phase_1_days: 17
   *                     phase_2_days: 17
   *                     phase_3_days: 16
   *                     full_length_days: 6
   *       400:
   *         description: Bad request - invalid parameters
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *             examples:
   *               missing_params:
   *                 summary: Missing required parameters
   *                 value:
   *                   error: 'Missing required parameters'
   *                   required: ['start_date', 'test_date', 'priorities', 'availability', 'fl_weekday']
   *               invalid_date:
   *                 summary: Invalid date format
   *                 value:
   *                   error: 'Invalid date format. Use YYYY-MM-DD format'
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
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

  /**
   * @swagger
   * /health:
   *   get:
   *     summary: Health check endpoint
   *     description: Returns the health status of the service
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Service is healthy
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   example: 'healthy'
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   *                   example: '2025-01-27T10:30:00.000Z'
   *                 service:
   *                   type: string
   *                   example: 'MCAT Study Schedule Planner'
   */
  async getHealth(req: Request, res: Response): Promise<void> {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'MCAT Study Schedule Planner'
    });
  }
}
