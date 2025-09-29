import { Workbook, Worksheet } from 'exceljs';
import { pool } from '../database/connection';
import { Topic, KhanAcademyResource, KaplanResource, JackWestinResource, UWorldResource, AAMCResource } from '../models/types';

export class DataLoader {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async loadAllData(): Promise<void> {
    console.log('📊 Loading Excel data into database...');
    
    try {
      const workbook = new Workbook();
      await workbook.xlsx.readFile(this.filePath);
      
      // Load each sheet
      await this.loadTopics(workbook);
      await this.loadKhanAcademyResources(workbook);
      await this.loadKaplanResources(workbook);
      await this.loadJackWestinResources(workbook);
      await this.loadUWorldResources(workbook);
      await this.loadAAMCResources(workbook);
      
      console.log('✅ All data loaded successfully');
    } catch (error) {
      console.error('❌ Error loading data:', error);
      throw error;
    }
  }

  private async loadTopics(workbook: Workbook): Promise<void> {
    const sheet = workbook.getWorksheet('Organized_MCAT_Topics');
    if (!sheet) {
      throw new Error('Organized_MCAT_Topics sheet not found');
    }

    const data = this.sheetToJson(sheet);
    const client = await pool.connect();

    try {
      // Clear existing data
      await client.query('DELETE FROM topics');
      
      for (const row of data as any[]) {
        await client.query(`
          INSERT INTO topics (content_category_number, content_category_title, subtopic_number, subtopic_title, concept_number, concept_title, high_yield, key)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          row['content_category_#'],
          row['content_category_title'],
          row['subtopic_number'],
          row['subtopic_title'],
          row['concept_number'],
          row['concept_title'],
          row['high_yield'] === 'Yes',
          row['key']
        ]);
      }
      
      console.log(`✅ Loaded ${data.length} topics`);
    } finally {
      client.release();
    }
  }

  private async loadKhanAcademyResources(workbook: Workbook): Promise<void> {
    const sheet = workbook.getWorksheet('Khan Academy Resources');
    if (!sheet) {
      throw new Error('Khan Academy Resources sheet not found');
    }

    const data = this.sheetToJson(sheet);
    const client = await pool.connect();

    try {
      await client.query('DELETE FROM khan_academy_resources');
      
      for (const row of data as any[]) {
        await client.query(`
          INSERT INTO khan_academy_resources (stable_id, title, url, resource_type, key, time_minutes)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          row['stable_id'] || null,
          row['title'],
          row['url'],
          row['resource_type'],
          row['key'],
          row['time_minutes'] || this.getDefaultTime('KA', row['resource_type'])
        ]);
      }
      
      console.log(`✅ Loaded ${data.length} Khan Academy resources`);
    } finally {
      client.release();
    }
  }

  private async loadKaplanResources(workbook: Workbook): Promise<void> {
    const sheet = workbook.getWorksheet('Kaplan_Table__Only_Sciences');
    if (!sheet) {
      throw new Error('Kaplan_Table__Only_Sciences sheet not found');
    }

    const data = this.sheetToJson(sheet);
    const client = await pool.connect();

    try {
      await client.query('DELETE FROM kaplan_resources');
      
      for (const row of data as any[]) {
        await client.query(`
          INSERT INTO kaplan_resources (stable_id, title, url, key, time_minutes, high_yield)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          row['stable_id'] || null,
          row['title'],
          row['url'],
          row['key'],
          30, // Default Kaplan timing
          row['high_yield'] === 'Yes'
        ]);
      }
      
      console.log(`✅ Loaded ${data.length} Kaplan resources`);
    } finally {
      client.release();
    }
  }

  private async loadJackWestinResources(workbook: Workbook): Promise<void> {
    const sheet = workbook.getWorksheet('Jack Westin Resources');
    if (!sheet) {
      throw new Error('Jack Westin Resources sheet not found');
    }

    const data = this.sheetToJson(sheet);
    const client = await pool.connect();

    try {
      await client.query('DELETE FROM jack_westin_resources');
      
      for (const row of data as any[]) {
        await client.query(`
          INSERT INTO jack_westin_resources (stable_id, title, url, resource_type, key, time_minutes)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          row['stable_id'] || null,
          row['title'],
          row['url'],
          row['resource_type'],
          row['key'],
          row['time_minutes'] || this.getDefaultTime('JW', row['resource_type'])
        ]);
      }
      
      console.log(`✅ Loaded ${data.length} Jack Westin resources`);
    } finally {
      client.release();
    }
  }

  private async loadUWorldResources(workbook: Workbook): Promise<void> {
    const sheet = workbook.getWorksheet('UWorld Question Sets');
    if (!sheet) {
      throw new Error('UWorld Question Sets sheet not found');
    }

    const data = this.sheetToJson(sheet);
    const client = await pool.connect();

    try {
      await client.query('DELETE FROM uworld_resources');
      
      for (const row of data as any[]) {
        await client.query(`
          INSERT INTO uworld_resources (stable_id, title, url, key, time_minutes, question_count)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          row['stable_id'] || null,
          row['title'],
          row['url'],
          row['key'],
          30, // Default UWorld timing
          10  // Default question count
        ]);
      }
      
      console.log(`✅ Loaded ${data.length} UWorld resources`);
    } finally {
      client.release();
    }
  }

  private async loadAAMCResources(workbook: Workbook): Promise<void> {
    const sheet = workbook.getWorksheet('AAMC Materials');
    if (!sheet) {
      throw new Error('AAMC Materials sheet not found');
    }

    const data = this.sheetToJson(sheet);
    const client = await pool.connect();

    try {
      await client.query('DELETE FROM aamc_resources');
      
      for (const row of data as any[]) {
        await client.query(`
          INSERT INTO aamc_resources (stable_id, title, url, resource_type, key, time_minutes, pack_name)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          row['stable_id'] || null,
          row['title'],
          row['url'],
          row['resource_type'],
          row['key'],
          row['time_minutes'] || this.getDefaultTime('AAMC', row['resource_type']),
          row['pack_name'] || null
        ]);
      }
      
      console.log(`✅ Loaded ${data.length} AAMC resources`);
    } finally {
      client.release();
    }
  }

  private getDefaultTime(provider: string, resourceType: string): number {
    const defaults: Record<string, Record<string, number>> = {
      'KA': {
        'Video': 12,
        'Article': 10,
        'Practice Passage': 25,
        'Discrete Practice Question': 30
      },
      'JW': {
        'CARS Passage': 25,
        'Discrete Practice Question': 30
      },
      'AAMC': {
        'Question Pack': 30,
        'Full Length': 300
      }
    };

    return defaults[provider]?.[resourceType] || 30;
  }

  private sheetToJson(sheet: Worksheet): any[] {
    const headerRow = sheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: true }, (cell: any, colNumber: number) => {
      const headerValue = (cell.value ?? '').toString().trim();
      headers[colNumber - 1] = headerValue;
    });

    const rows: any[] = [];
    const lastRowNumber = sheet.lastRow ? sheet.lastRow.number : 1;

    for (let rowNumber = 2; rowNumber <= lastRowNumber; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      if (!row || row.actualCellCount === 0) continue;

      const obj: Record<string, any> = {};
      headers.forEach((header: string, index: number) => {
        if (!header) return;
        const cell = row.getCell(index + 1);
        const value = cell.value;
        // Normalize value similar to XLSX.utils.sheet_to_json default behavior
        if (value && typeof value === 'object' && 'text' in (value as any)) {
          obj[header] = (value as any).text;
        } else if (value && typeof value === 'object' && 'result' in (value as any)) {
          obj[header] = (value as any).result;
        } else {
          obj[header] = value as any;
        }
      });

      // Skip entirely empty objects
      if (Object.values(obj).every(v => v === null || v === undefined || v === '')) continue;
      rows.push(obj);
    }

    return rows;
  }
}
