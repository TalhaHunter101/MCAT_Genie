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
    return `${resource.title.toLowerCase().trim()}+${resource.url}`;
  }

  async selectResources(
    anchor: Topic,
    slotType: string,
    phase: number,
    usedResources: Set<string>,
    timeBudget: number
  ): Promise<ResourceSelection[]> {
    const candidates: ResourceSelection[] = [];
    
    // Get resources based on anchor key and slot type
    const resources = await this.getResourcesForSlot(anchor, slotType, phase);
    
    for (const resource of resources) {
      if (usedResources.has(this.getResourceUid(resource))) {
        continue;
      }
      
      const specificity = this.calculateSpecificity(anchor.key, resource.key);
      const timeFit = this.calculateTimeFit(resource.time_minutes, slotType);
      
      candidates.push({
        resource,
        provider: this.getProvider(resource),
        time_minutes: resource.time_minutes,
        specificity
      });
    }
    
    // Sort candidates by selection criteria
    return this.sortCandidates(candidates, timeBudget);
  }

  private async getResourcesForSlot(anchor: Topic, slotType: string, phase: number): Promise<Resource[]> {
    const key = anchor.key;
    let resources: Resource[] = [];
    
    switch (slotType) {
      case 'ka_video':
        resources = await this.getKhanAcademyResources(key, 'Video');
        break;
      case 'ka_article':
        resources = await this.getKhanAcademyResources(key, 'Article');
        break;
      case 'kaplan':
        resources = await this.getKaplanResources(key, true);
        break;
      case 'ka_discrete':
        resources = await this.getKhanAcademyResources(key, 'Discrete Practice Question');
        break;
      case 'jw_discrete':
        resources = await this.getJackWestinResources(key, 'Discrete Practice Question');
        break;
      case 'jw_passage':
        resources = await this.getJackWestinResources(key, 'CARS Passage');
        break;
      case 'uworld':
        resources = await this.getUWorldResources(key);
        break;
      case 'aamc_set':
        resources = await this.getAAMCResources(key, 'Question Pack');
        break;
      case 'aamc_cars':
        resources = await this.getAAMCResources(key, 'CARS Passage');
        break;
    }
    
    return resources;
  }

  private calculateSpecificity(anchorKey: string, resourceKey: string): number {
    if (anchorKey === resourceKey) return 0; // Exact match
    if (resourceKey.endsWith('.x.x')) return 2; // Category level
    if (resourceKey.endsWith('.x')) return 1; // Subtopic level
    return 3; // No match
  }

  private calculateTimeFit(timeMinutes: number, slotType: string): number {
    const targets: Record<string, number> = {
      'ka_video': 15,
      'kaplan': 30,
      'ka_discrete': 30,
      'jw_discrete': 30,
      'jw_passage': 25,
      'uworld': 30,
      'aamc_set': 30,
      'aamc_cars': 25
    };
    
    const target = targets[slotType] || 30;
    return Math.abs(timeMinutes - target);
  }

  private sortCandidates(candidates: ResourceSelection[], timeBudget: number): ResourceSelection[] {
    return candidates
      .filter(c => c.time_minutes <= timeBudget)
      .sort((a, b) => {
        // 1. Specificity (lower is better)
        if (a.specificity !== b.specificity) {
          return a.specificity - b.specificity;
        }
        
        // 2. Time fit (lower is better)
        const aTimeFit = this.calculateTimeFit(a.time_minutes, this.getSlotType(a));
        const bTimeFit = this.calculateTimeFit(b.time_minutes, this.getSlotType(b));
        if (aTimeFit !== bTimeFit) {
          return aTimeFit - bTimeFit;
        }
        
        // 3. Title A-Z
        return a.resource.title.localeCompare(b.resource.title);
      });
  }

  private getProvider(resource: Resource): string {
    if ('resource_type' in resource) {
      if (resource.resource_type === 'Video' || resource.resource_type === 'Article' || 
          resource.resource_type === 'Practice Passage' || resource.resource_type === 'Discrete Practice Question') {
        return 'Khan Academy';
      }
      if (resource.resource_type === 'CARS Passage') {
        return 'Jack Westin';
      }
      if (resource.resource_type === 'Question Pack' || resource.resource_type === 'Full Length') {
        return 'AAMC';
      }
    }
    if ('high_yield' in resource) {
      return 'Kaplan';
    }
    if ('question_count' in resource) {
      return 'UWorld';
    }
    return 'Unknown';
  }

  private getSlotType(selection: ResourceSelection): string {
    const provider = selection.provider;
    const resource = selection.resource;
    
    if (provider === 'Khan Academy' && 'resource_type' in resource) {
      switch (resource.resource_type) {
        case 'Video': return 'ka_video';
        case 'Article': return 'ka_article';
        case 'Discrete Practice Question': return 'ka_discrete';
      }
    }
    if (provider === 'Kaplan') return 'kaplan';
    if (provider === 'Jack Westin' && 'resource_type' in resource) {
      return resource.resource_type === 'CARS Passage' ? 'jw_passage' : 'jw_discrete';
    }
    if (provider === 'UWorld') return 'uworld';
    if (provider === 'AAMC' && 'resource_type' in resource) {
      return resource.resource_type === 'CARS Passage' ? 'aamc_cars' : 'aamc_set';
    }
    
    return 'unknown';
  }
}
