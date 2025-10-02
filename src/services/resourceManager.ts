import { pool } from "../database/connection";
import {
  Resource,
  UsedResource,
  ResourceSelection,
  Topic,
} from "../models/types";

export class ResourceManager {
  private scheduleId: string;

  constructor(scheduleId: string) {
    this.scheduleId = scheduleId;
  }

  async getUsedResources(): Promise<Set<string>> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        "SELECT resource_uid FROM used_resources WHERE schedule_id = $1",
        [this.scheduleId]
      );
      return new Set(result.rows.map((row) => row.resource_uid));
    } finally {
      client.release();
    }
  }

  async markResourceAsUsed(
    resource: Resource,
    provider: string,
    usedDate: string
  ): Promise<void> {
    const client = await pool.connect();
    try {
      const resourceUid = this.getResourceUid(resource);
      await client.query(
        `
        INSERT INTO used_resources (schedule_id, provider, resource_id, resource_uid, used_date)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (schedule_id, resource_uid) DO NOTHING
      `,
        [this.scheduleId, provider, resource.id, resourceUid, usedDate]
      );
    } finally {
      client.release();
    }
  }

  async getTopicsByPriority(priorities: string[]): Promise<Topic[]> {
    const client = await pool.connect();
    try {
      const priorityKeys = priorities.map((p) => p + "%");
      const placeholders = priorityKeys.map((_, i) => `$${i + 1}`).join(",");

      const result = await client.query(
        `
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
      `,
        priorityKeys
      );

      return result.rows;
    } finally {
      client.release();
    }
  }

  async getKhanAcademyResources(
    key: string,
    resourceType?: string
  ): Promise<Resource[]> {
    const client = await pool.connect();
    try {
      // Use fallback hierarchy: exact match -> subtopic -> category
      // We need to match resources that have the EXACT key in our matching keys list
      const matchingKeys = this.getMatchingKeys(key);
      const keyConditions = matchingKeys
        .map((_, i) => `key = $${i + 1}`)
        .join(" OR ");

      let query = `
        SELECT * FROM khan_academy_resources 
        WHERE (${keyConditions})
      `;
      const params: any[] = matchingKeys;

      if (resourceType) {
        query += " AND resource_type = $" + (matchingKeys.length + 1);
        params.push(resourceType);
      }

      query += " ORDER BY title";

      const result = await client.query(query, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  private getMatchingKeys(anchorKey: string): string[] {
    const parts = anchorKey.split(".");
    const category = parts[0];
    const subtopic = parts[1];
    const concept = parts[2];
    const keys: string[] = [];

    // Add exact match (concept level)
    keys.push(anchorKey);

    // Add subtopic level with .x notation if not already at subtopic level
    if (concept && concept !== "x") {
      keys.push(`${category}.${subtopic}.x`);
    }

    // Add category level with .x.x notation if not already at category level
    if (subtopic && subtopic !== "x") {
      keys.push(`${category}.x.x`);
    }

    return keys;
  }

  async getKaplanResources(
    key: string,
    highYieldOnly: boolean = false
  ): Promise<Resource[]> {
    const client = await pool.connect();
    try {
      // Use fallback hierarchy: exact match -> subtopic -> category
      const matchingKeys = this.getMatchingKeys(key);
      const keyConditions = matchingKeys
        .map((_, i) => `key = $${i + 1}`)
        .join(" OR ");

      let query = `
        SELECT * FROM kaplan_resources 
        WHERE (${keyConditions})
      `;
      const params: any[] = matchingKeys;

      if (highYieldOnly) {
        query += " AND high_yield = true";
      }

      query += " ORDER BY title";

      const result = await client.query(query, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async getJackWestinResources(
    key: string,
    resourceType?: string
  ): Promise<Resource[]> {
    const client = await pool.connect();
    try {
      // Use fallback hierarchy: exact match -> subtopic -> category
      const matchingKeys = this.getMatchingKeys(key);
      const keyConditions = matchingKeys
        .map((_, i) => `key = $${i + 1}`)
        .join(" OR ");

      let query = `
        SELECT * FROM jack_westin_resources 
        WHERE (${keyConditions})
      `;
      const params: any[] = matchingKeys;

      if (resourceType) {
        query += " AND resource_type = $" + (matchingKeys.length + 1);
        params.push(resourceType);
      }

      query += " ORDER BY title";

      const result = await client.query(query, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async getCarsPassages(): Promise<Resource[]> {
    const client = await pool.connect();
    try {
      // Get CARS passages from Jack Westin using the cars_resource flag
      // This flag is set during data loading to identify resources from the CARS section
      const query = `
        SELECT * FROM jack_westin_resources 
        WHERE cars_resource = true
        ORDER BY RANDOM()
      `;
      const result = await client.query(query);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async getUWorldResources(key: string): Promise<Resource[]> {
    const client = await pool.connect();
    try {
      // Use fallback hierarchy: exact match -> subtopic -> category
      const matchingKeys = this.getMatchingKeys(key);
      const keyConditions = matchingKeys
        .map((_, i) => `key = $${i + 1}`)
        .join(" OR ");

      const result = await client.query(
        `
        SELECT * FROM uworld_resources 
        WHERE (${keyConditions})
        ORDER BY title
      `,
        matchingKeys
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  async getAAMCResources(
    key: string,
    resourceType?: string
  ): Promise<Resource[]> {
    const client = await pool.connect();
    try {
      // AAMC resources are general practice materials, not topic-specific
      // So we return all AAMC resources regardless of the key
      let query = `SELECT * FROM aamc_resources WHERE 1=1`;
      const params: any[] = [];

      if (resourceType) {
        query += " AND resource_type = $1";
        params.push(resourceType);
      }

      query += " ORDER BY title";

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
