import { pool } from '../database/connection';
import { Resource, UsedResource, ResourceSelection, Topic } from '../models/types';

export class ResourceManager {
  private scheduleId: string;

  constructor(scheduleId: string) {
    this.scheduleId = scheduleId;
  }

  async getUsedResources(): Promise<Set<string>> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT resource_uid FROM used_resources WHERE schedule_id = $1',
        [this.scheduleId]
      );
      return new Set(result.rows.map(row => row.resource_uid));
    } finally {
      client.release();
    }
  }

  async markResourceAsUsed(resource: Resource, provider: string, usedDate: string): Promise<void> {
    const client = await pool.connect();
    try {
      const resourceUid = this.getResourceUid(resource);
      await client.query(`
        INSERT INTO used_resources (schedule_id, provider, resource_id, resource_uid, used_date)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (schedule_id, resource_uid) DO NOTHING
      `, [this.scheduleId, provider, resource.id, resourceUid, usedDate]);
    } finally {
      client.release();
    }
  }

  async getTopicsByPriority(priorities: string[]): Promise<Topic[]> {
    const client = await pool.connect();
    try {
      const priorityKeys = priorities.map(p => p + '.%');
      const placeholders = priorityKeys.map((_, i) => `$${i + 1}`).join(',');
      
      const result = await client.query(`
        SELECT * FROM topics 
        WHERE key LIKE ANY(ARRAY[${placeholders}])
        ORDER BY 
          CASE 
            WHEN key ~ '^[0-9]+[A-Z]\\.[0-9]+\\.[0-9]+$' THEN 0
            WHEN key ~ '^[0-9]+[A-Z]\\.[0-9]+\\.x$' THEN 1
            WHEN key ~ '^[0-9]+[A-Z]\\.x\\.x$' THEN 2
            ELSE 3
          END,
          content_category_number,
          subtopic_number,
          concept_number
      `, priorityKeys);
      
      return result.rows;
    } finally {
      client.release();
    }
  }

  async getKhanAcademyResources(key: string, resourceType?: string): Promise<Resource[]> {
    const client = await pool.connect();
    try {
      let query = `
        SELECT * FROM khan_academy_resources 
        WHERE key = $1
      `;
      const params: any[] = [key];
      
      if (resourceType) {
        query += ' AND resource_type = $2';
        params.push(resourceType);
      }
      
      query += ' ORDER BY title';
      
      const result = await client.query(query, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async getKaplanResources(key: string, highYieldOnly: boolean = false): Promise<Resource[]> {
    const client = await pool.connect();
    try {
      let query = `
        SELECT * FROM kaplan_resources 
        WHERE key = $1
      `;
      const params: any[] = [key];
      
      if (highYieldOnly) {
        query += ' AND high_yield = true';
      }
      
      query += ' ORDER BY title';
      
      const result = await client.query(query, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async getJackWestinResources(key: string, resourceType?: string): Promise<Resource[]> {
    const client = await pool.connect();
    try {
      let query = `
        SELECT * FROM jack_westin_resources 
        WHERE key = $1
      `;
      const params: any[] = [key];
      
      if (resourceType) {
        query += ' AND resource_type = $2';
        params.push(resourceType);
      }
      
      query += ' ORDER BY title';
      
      const result = await client.query(query, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async getUWorldResources(key: string): Promise<Resource[]> {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT * FROM uworld_resources 
        WHERE key = $1
        ORDER BY title
      `, [key]);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async getAAMCResources(key: string, resourceType?: string): Promise<Resource[]> {
    const client = await pool.connect();
    try {
      let query = `
        SELECT * FROM aamc_resources 
        WHERE key = $1
      `;
      const params: any[] = [key];
      
      if (resourceType) {
        query += ' AND resource_type = $2';
        params.push(resourceType);
      }
      
      query += ' ORDER BY title';
      
      const result = await client.query(query, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async getAAMCFullLengths(): Promise<Resource[]> {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT * FROM aamc_resources 
        WHERE resource_type = 'Full Length'
        ORDER BY title
      `);
      return result.rows;
    } finally {
      client.release();
    }
  }

  private getResourceUid(resource: Resource): string {
    if (resource.stable_id) {
      return resource.stable_id;
    }
    // Fallback: use title + key for unique identification
    return `${resource.title.toLowerCase().trim()}+${resource.key}`;
  }

}
