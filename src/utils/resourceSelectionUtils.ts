import { Resource, Topic, ResourceSelection } from '../models/types';

export interface KeyParts {
  category: string;
  subtopic: number;
  concept: number;
  specificity: number; // 0=concept, 1=subtopic, 2=category
}

export interface TimeFitConfig {
  target: number;
  bandMin: number;
  bandMax: number;
}

export class ResourceSelectionUtils {
  private static readonly TIME_FIT_CONFIGS: Record<string, TimeFitConfig> = {
    'KA video': { target: 15, bandMin: 10, bandMax: 15 },
    'KA article': { target: 10, bandMin: 8, bandMax: 12 },
    'Kaplan': { target: 30, bandMin: 20, bandMax: 30 },
    'Discrete': { target: 30, bandMin: 25, bandMax: 35 },
    'Passage': { target: 25, bandMin: 20, bandMax: 25 },
    'UWorld 10Q': { target: 30, bandMin: 25, bandMax: 35 },
    'AAMC': { target: 30, bandMin: 25, bandMax: 35 }
  };

  /**
   * Parse a key string into its components
   * Examples: "1A.1.1" -> {category: "1A", subtopic: 1, concept: 1, specificity: 0}
   *           "1A.1.x" -> {category: "1A", subtopic: 1, concept: 0, specificity: 1}
   *           "1A.x.x" -> {category: "1A", subtopic: 0, concept: 0, specificity: 2}
   */
  static parseKey(key: string): KeyParts {
    const parts = key.split('.');
    const category = parts[0];
    
    if (parts.length !== 3) {
      throw new Error(`Invalid key format: ${key}`);
    }

    const subtopic = parts[1] === 'x' ? 0 : parseInt(parts[1], 10);
    const concept = parts[2] === 'x' ? 0 : parseInt(parts[2], 10);

    let specificity: number;
    if (concept > 0) {
      specificity = 0; // Concept level
    } else if (subtopic > 0) {
      specificity = 1; // Subtopic level
    } else {
      specificity = 2; // Category level
    }

    return { category, subtopic, concept, specificity };
  }

  /**
   * Generate matching keys with fallback hierarchy
   * Concept -> Subtopic -> Category
   */
  static getMatchingKeys(anchorKey: string): string[] {
    const parts = anchorKey.split('.');
    const category = parts[0];
    const subtopic = parts[1];
    const concept = parts[2];
    const keys: string[] = [];

    // Add exact match (concept level)
    keys.push(anchorKey);

    // Add subtopic level with .x notation if not already at subtopic level
    if (concept && concept !== 'x') {
      keys.push(`${category}.${subtopic}.x`);
    }

    // Add category level with .x.x notation if not already at category level
    if (subtopic && subtopic !== 'x') {
      keys.push(`${category}.x.x`);
    }

    return keys;
  }

  /**
   * Calculate time-fit score for a resource
   * Lower score is better (0 = perfect fit within band)
   */
  static calculateTimeFit(timeMinutes: number, resourceType: string): number {
    const config = this.TIME_FIT_CONFIGS[resourceType] || this.TIME_FIT_CONFIGS['AAMC'];
    
    // Perfect fit within band
    if (timeMinutes >= config.bandMin && timeMinutes <= config.bandMax) {
      return 0;
    }
    
    // Calculate distance from target
    return Math.abs(timeMinutes - config.target);
  }

  /**
   * Calculate specificity match between anchor and resource
   * Lower score is better (0 = exact match)
   */
  static calculateSpecificity(anchorKey: string, resourceKey: string): number {
    const anchorParts = this.parseKey(anchorKey);
    const resourceParts = this.parseKey(resourceKey);

    // Exact match
    if (anchorKey === resourceKey) {
      return 0;
    }

    // Same category and subtopic
    if (anchorParts.category === resourceParts.category && 
        anchorParts.subtopic === resourceParts.subtopic) {
      return 1;
    }

    // Same category only
    if (anchorParts.category === resourceParts.category) {
      return 2;
    }

    // No match
    return 3;
  }

  /**
   * Calculate numeric key order score
   * Lower score comes first in sort
   */
  static calculateNumericOrder(key: string): number {
    const parts = this.parseKey(key);
    
    // Use a large multiplier to ensure proper ordering
    return (parts.subtopic * 1000) + parts.concept;
  }

  /**
   * Get provider rank for sorting
   * Lower number = higher priority
   */
  static getProviderRank(provider: string): number {
    const ranks: Record<string, number> = {
      'Khan Academy': 1,
      'Kaplan': 2,
      'Jack Westin': 3,
      'UWorld': 4,
      'AAMC': 5
    };
    return ranks[provider] || 999;
  }

  /**
   * Get resource type for time-fit calculation
   */
  static getResourceType(resource: Resource): string {
    if ('resource_type' in resource) {
      const resType = (resource as any).resource_type as string;
      if (resType === 'Videos') return 'KA video';
      if (resType === 'Articles') return 'KA article';
      if (resType === 'Practice Passages') return 'Passage';
      if (resType === 'Discrete Practice Questions') return 'Discrete';
      if (resType === 'aamc_style_discrete') return 'Discrete';
      if (resType === 'fundamental_discrete') return 'Discrete';
      if (resType === 'aamc_style_passage') return 'Passage';
      if (resType === 'fundamental_passage') return 'Passage';
      if (resType === 'CARS Passage') return 'Passage';
      if (resType === 'Question Pack') return 'AAMC';
      if (resType === 'Full Length') return 'AAMC';
      return 'AAMC';
    }
    if ('high_yield' in resource) return 'Kaplan';
    if ('question_count' in resource) return 'UWorld 10Q';
    return 'AAMC';
  }

  /**
   * Sort resources by all selection criteria
   */
  static sortResources(
    resources: ResourceSelection[], 
    anchorKey: string,
    timeBudget: number
  ): ResourceSelection[] {
    return resources
      .filter(r => r.time_minutes <= timeBudget)
      .sort((a, b) => {
        // 1. Specificity (lower is better)
        if (a.specificity !== b.specificity) {
          return a.specificity - b.specificity;
        }

        // 2. Numeric key order (lower is better)
        const aNumeric = this.calculateNumericOrder(a.resource.key);
        const bNumeric = this.calculateNumericOrder(b.resource.key);
        if (aNumeric !== bNumeric) {
          return aNumeric - bNumeric;
        }

        // 3. Time-fit (lower is better)
        const aTimeFit = this.calculateTimeFit(a.time_minutes, this.getResourceType(a.resource));
        const bTimeFit = this.calculateTimeFit(b.time_minutes, this.getResourceType(b.resource));
        if (aTimeFit !== bTimeFit) {
          return aTimeFit - bTimeFit;
        }

        // 4. Provider rank (lower is better)
        const aProviderRank = this.getProviderRank(a.provider);
        const bProviderRank = this.getProviderRank(b.provider);
        if (aProviderRank !== bProviderRank) {
          return aProviderRank - bProviderRank;
        }

        // 5. Title A-Z
        const titleCompare = a.resource.title.localeCompare(b.resource.title);
        if (titleCompare !== 0) {
          return titleCompare;
        }

        // 6. Stable ID (if available)
        const aStableId = a.resource.stable_id || '';
        const bStableId = b.resource.stable_id || '';
        return aStableId.localeCompare(bStableId);
      });
  }

  /**
   * Filter resources by high-yield status
   */
  static filterHighYield(resources: Resource[], topics: Topic[]): Resource[] {
    const highYieldKeys = new Set(
      topics.filter(t => t.high_yield).map(t => t.key)
    );

    return resources.filter(resource => {
      // Check if any matching topic is high-yield
      const matchingKeys = this.getMatchingKeys(resource.key);
      return matchingKeys.some(key => highYieldKeys.has(key));
    });
  }

  /**
   * Check if resource is used in Phase 1
   */
  static isUsedInPhase1(resource: Resource, usedResources: Set<string>): boolean {
    const resourceUid = this.getResourceUid(resource);
    return usedResources.has(resourceUid);
  }

  /**
   * Generate resource UID for tracking
   */
  static getResourceUid(resource: Resource): string {
    if (resource.stable_id) {
      return resource.stable_id;
    }
    // Fallback: use title + resource type + key for unique identification
    return `${resource.title.toLowerCase().trim()}+${resource.key}`;
  }

  /**
   * Check if two AAMC resources are from different packs
   */
  static areFromDifferentPacks(resource1: Resource, resource2: Resource): boolean {
    const pack1 = (resource1 as any).pack_name || 'Unknown';
    const pack2 = (resource2 as any).pack_name || 'Unknown';
    return pack1 !== pack2;
  }

  /**
   * Select resources for a specific slot with all constraints
   */
  static selectResourcesForSlot(
    anchor: Topic,
    slotType: string,
    phase: number,
    availableResources: Resource[],
    usedResources: Set<string>,
    timeBudget: number,
    topics: Topic[],
    sameDayUsed: Set<string> = new Set()
  ): ResourceSelection[] {
    // 1. Filter by slot type only (key filtering already done by ResourceManager)
    let candidates = availableResources.filter(resource => {
      const slotMatch = this.matchesSlotType(resource, slotType);
      return slotMatch;
    });

    // 2. Filter by high-yield for Phases 1-2 (PREFERENCE, not requirement)
    // Sort high-yield to the top, but keep low-yield as fallback
    if (phase <= 2) {
      const highYieldCandidates = this.filterHighYield(candidates, topics);
      const lowYieldCandidates = candidates.filter(c => 
        !highYieldCandidates.find(hy => this.getResourceUid(hy) === this.getResourceUid(c))
      );
      // Place high-yield first, then low-yield as fallback
      candidates = [...highYieldCandidates, ...lowYieldCandidates];
      
      // If no high-yield candidates remain after filtering, ensure we have fallback options
      if (highYieldCandidates.length === 0 && lowYieldCandidates.length === 0) {
        // Last resort: use any available resources regardless of high-yield status
        candidates = availableResources.filter(resource => {
          const slotMatch = this.matchesSlotType(resource, slotType);
          return slotMatch;
        });
      }
    }

    // 3. Filter by never-repeat constraint (except AAMC/UWorld which can repeat)
    // Per requirements: "UWorld can repeat while sets remain" and AAMC has limited resources
    const isUWorld = slotType === 'uworld';
    const isAAMC = phase === 3;
    
    if (isAAMC || isUWorld) {
      // Phase 3 (AAMC) and UWorld: Allow repetition across days
      // Only filter same-day duplicates (done in next step)
    } else {
      // Phases 1-2: Strict never-repeat for KA/Kaplan/JW, but allow fallback if exhausted
      const unusedCandidates = candidates.filter(resource => 
        !usedResources.has(this.getResourceUid(resource))
      );
      
      // If we have unused candidates, use them. Otherwise, allow repetition as last resort
      if (unusedCandidates.length > 0) {
        candidates = unusedCandidates;
      } else if (candidates.length === 0) {
        // Last resort: allow any matching resources even if used before
        candidates = availableResources.filter(resource => {
          const slotMatch = this.matchesSlotType(resource, slotType);
          return slotMatch;
        });
      }
    }

    // 4. Filter by same-day deduplication (but allow if no alternatives)
    const nonDuplicateCandidates = candidates.filter(resource => 
      !sameDayUsed.has(this.getResourceUid(resource))
    );
    
    // Use non-duplicates if available, otherwise allow duplicates to avoid empty blocks
    if (nonDuplicateCandidates.length > 0) {
      candidates = nonDuplicateCandidates;
    }

    // 5. Phase-specific filtering
    if (phase === 2) {
      // Phase 2 discretes must not be used in Phase 1, but allow if no alternatives
      const nonPhase1Candidates = candidates.filter(resource => 
        !this.isUsedInPhase1(resource, usedResources)
      );
      
      // Use non-Phase1 candidates if available, otherwise allow Phase1 resources to avoid empty blocks
      if (nonPhase1Candidates.length > 0) {
        candidates = nonPhase1Candidates;
      }
    }

    // 6. Convert to ResourceSelection objects
    const selections: ResourceSelection[] = candidates.map(resource => ({
      resource,
      provider: this.getProvider(resource),
      time_minutes: resource.time_minutes,
      specificity: this.calculateSpecificity(anchor.key, resource.key)
    }));

    // 7. Sort by all criteria
    const sortedSelections = this.sortResources(selections, anchor.key, timeBudget);
    return sortedSelections;
  }

  /**
   * Check if resource matches slot type
   */
  private static matchesSlotType(resource: Resource, slotType: string): boolean {
    if ('resource_type' in resource) {
      const resType = (resource as any).resource_type as string;
      if (slotType === 'ka_video') return resType === 'Videos';
      if (slotType === 'ka_article') return resType === 'Articles';
      if (slotType === 'ka_discrete') {
        return resType === 'Discrete Practice Questions' || 
               resType === 'aamc_style_discrete' || 
               resType === 'fundamental_discrete';
      }
      if (slotType === 'jw_discrete') {
        return resType === 'aamc_style_discrete' || 
               resType === 'fundamental_discrete';
      }
      if (slotType === 'jw_passage') {
        return resType === 'aamc_style_passage' || 
               resType === 'fundamental_passage';
      }
      if (slotType === 'aamc_cars') return resType === 'CARS Passage';
      if (slotType === 'aamc_set') return resType === 'Question Pack';
      return false;
    }
    if ('high_yield' in resource) return slotType === 'kaplan';
    if ('question_count' in resource) return slotType === 'uworld';
    return false;
  }

  /**
   * Get provider name for resource
   */
  private static getProvider(resource: Resource): string {
    if ('resource_type' in resource) {
      const resType = (resource as any).resource_type as string;
      if (['Videos', 'Articles', 'Practice Passages', 'Discrete Practice Questions'].includes(resType)) {
        return 'Khan Academy';
      }
      if (['aamc_style_discrete', 'aamc_style_passage', 'fundamental_discrete', 'fundamental_passage'].includes(resType)) {
        return 'Jack Westin';
      }
      if (resType === 'CARS Passage') {
        return 'AAMC';
      }
      if (['Question Pack', 'Full Length'].includes(resType)) {
        return 'AAMC';
      }
    }
    if ('high_yield' in resource) return 'Kaplan';
    if ('question_count' in resource) return 'UWorld';
    return 'Unknown';
  }
}
