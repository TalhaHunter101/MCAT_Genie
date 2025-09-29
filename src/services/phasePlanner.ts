import { ResourceManager } from './resourceManager';
import { Topic, ScheduleDay, ResourceSelection } from '../models/types';
import { DateUtils } from '../utils/dateUtils';

export class PhasePlanner {
  private resourceManager: ResourceManager;
  private usedResources: Set<string> = new Set();

  constructor(resourceManager: ResourceManager) {
    this.resourceManager = resourceManager;
  }

  async planPhase1Day(
    date: Date,
    anchor: Topic,
    usedResources: Set<string>
  ): Promise<ScheduleDay> {
    const blocks: any = {
      science_content: [],
      science_discretes: [],
      cars: [],
      written_review_minutes: 60,
      total_resource_minutes: 0
    };

    let remainingTime = 240; // 4 hours in minutes

    // 1. Science content: 1 Kaplan section + matching KA content
    const kaplanResources = await this.resourceManager.getKaplanResources(anchor.key, true);
    const kaVideos = await this.resourceManager.getKhanAcademyResources(anchor.key, 'Video');
    const kaArticles = await this.resourceManager.getKhanAcademyResources(anchor.key, 'Article');

    if (kaplanResources.length > 0 && remainingTime >= 30) {
      const kaplan = kaplanResources[0];
      blocks.science_content.push(kaplan.title);
      remainingTime -= kaplan.time_minutes;
      await this.resourceManager.markResourceAsUsed(kaplan, 'Kaplan', DateUtils.formatDate(date));
    }

    // Add matching KA content
    for (const video of kaVideos.slice(0, 2)) {
      if (remainingTime >= video.time_minutes && !usedResources.has(this.getResourceUid(video))) {
        blocks.science_content.push(video.title);
        remainingTime -= video.time_minutes;
        await this.resourceManager.markResourceAsUsed(video, 'Khan Academy', DateUtils.formatDate(date));
        break;
      }
    }

    for (const article of kaArticles.slice(0, 1)) {
      if (remainingTime >= article.time_minutes && !usedResources.has(this.getResourceUid(article))) {
        blocks.science_content.push(article.title);
        remainingTime -= article.time_minutes;
        await this.resourceManager.markResourceAsUsed(article, 'Khan Academy', DateUtils.formatDate(date));
        break;
      }
    }

    // 2. Science discretes: 1 KA or Jack Westin discrete set
    const kaDiscretes = await this.resourceManager.getKhanAcademyResources(anchor.key, 'Discrete Practice Question');
    const jwDiscretes = await this.resourceManager.getJackWestinResources(anchor.key, 'Discrete Practice Question');

    const discreteOptions = [...kaDiscretes, ...jwDiscretes].filter(d => 
      !usedResources.has(this.getResourceUid(d)) && remainingTime >= d.time_minutes
    );

    if (discreteOptions.length > 0) {
      const discrete = discreteOptions[0];
      blocks.science_discretes.push(discrete.title);
      remainingTime -= discrete.time_minutes;
      await this.resourceManager.markResourceAsUsed(discrete, this.getProvider(discrete), DateUtils.formatDate(date));
    }

    // 3. CARS: 2 Jack Westin passages
    const carsPassages = await this.resourceManager.getJackWestinResources(anchor.key, 'CARS Passage');
    for (const passage of carsPassages.slice(0, 2)) {
      if (remainingTime >= passage.time_minutes && !usedResources.has(this.getResourceUid(passage))) {
        blocks.cars.push(passage.title);
        remainingTime -= passage.time_minutes;
        await this.resourceManager.markResourceAsUsed(passage, 'Jack Westin', DateUtils.formatDate(date));
      }
    }

    blocks.total_resource_minutes = 240 - remainingTime;

    return {
      date: DateUtils.formatDate(date),
      kind: 'study',
      phase: 1,
      blocks
    };
  }

  async planPhase2Day(
    date: Date,
    anchor: Topic,
    usedResources: Set<string>
  ): Promise<ScheduleDay> {
    const blocks: any = {
      science_passages: [],
      uworld_set: [],
      extra_discretes: [],
      cars: [],
      written_review_minutes: 60,
      total_resource_minutes: 0
    };

    let remainingTime = 240;

    // 1. Science passages: 2 third-party passages
    const jwPassages = await this.resourceManager.getJackWestinResources(anchor.key, 'CARS Passage');
    for (const passage of jwPassages.slice(0, 2)) {
      if (remainingTime >= passage.time_minutes && !usedResources.has(this.getResourceUid(passage))) {
        blocks.science_passages.push(passage.title);
        remainingTime -= passage.time_minutes;
        await this.resourceManager.markResourceAsUsed(passage, 'Jack Westin', DateUtils.formatDate(date));
      }
    }

    // 2. UWorld: 1 set (10Q)
    const uworldResources = await this.resourceManager.getUWorldResources(anchor.key);
    if (uworldResources.length > 0 && remainingTime >= 30) {
      const uworld = uworldResources[0];
      blocks.uworld_set.push(uworld.title);
      remainingTime -= uworld.time_minutes;
      await this.resourceManager.markResourceAsUsed(uworld, 'UWorld', DateUtils.formatDate(date));
    }

    // 3. Extra discretes: 1-2 discrete sets (not used in Phase 1)
    const kaDiscretes = await this.resourceManager.getKhanAcademyResources(anchor.key, 'Discrete Practice Question');
    const jwDiscretes = await this.resourceManager.getJackWestinResources(anchor.key, 'Discrete Practice Question');

    const discreteOptions = [...kaDiscretes, ...jwDiscretes].filter(d => 
      !usedResources.has(this.getResourceUid(d)) && remainingTime >= d.time_minutes
    );

    for (const discrete of discreteOptions.slice(0, 2)) {
      if (remainingTime >= discrete.time_minutes) {
        blocks.extra_discretes.push(discrete.title);
        remainingTime -= discrete.time_minutes;
        await this.resourceManager.markResourceAsUsed(discrete, this.getProvider(discrete), DateUtils.formatDate(date));
      }
    }

    // 4. CARS: 2 Jack Westin passages
    for (const passage of jwPassages.slice(0, 2)) {
      if (remainingTime >= passage.time_minutes && !usedResources.has(this.getResourceUid(passage))) {
        blocks.cars.push(passage.title);
        remainingTime -= passage.time_minutes;
        await this.resourceManager.markResourceAsUsed(passage, 'Jack Westin', DateUtils.formatDate(date));
      }
    }

    blocks.total_resource_minutes = 240 - remainingTime;

    return {
      date: DateUtils.formatDate(date),
      kind: 'study',
      phase: 2,
      blocks
    };
  }

  async planPhase3Day(
    date: Date,
    anchor: Topic,
    usedResources: Set<string>
  ): Promise<ScheduleDay> {
    const blocks: any = {
      aamc_sets: [],
      aamc_CARS_passages: [],
      written_review_minutes: 60,
      total_resource_minutes: 0
    };

    let remainingTime = 240;

    // 1. AAMC sets: 2 × (20-30Q) from different packs
    const aamcSets = await this.resourceManager.getAAMCResources(anchor.key, 'Question Pack');
    const usedPacks = new Set<string>();

    for (const aamcSet of aamcSets.slice(0, 2)) {
      if (remainingTime >= aamcSet.time_minutes && !usedResources.has(this.getResourceUid(aamcSet))) {
        const packName = (aamcSet as any).pack_name || 'Unknown';
        if (!usedPacks.has(packName)) {
          blocks.aamc_sets.push(aamcSet.title);
          remainingTime -= aamcSet.time_minutes;
          usedPacks.add(packName);
          await this.resourceManager.markResourceAsUsed(aamcSet, 'AAMC', DateUtils.formatDate(date));
        }
      }
    }

    // 2. AAMC CARS passages: 2
    const aamcCars = await this.resourceManager.getAAMCResources(anchor.key, 'CARS Passage');
    for (const passage of aamcCars.slice(0, 2)) {
      if (remainingTime >= passage.time_minutes && !usedResources.has(this.getResourceUid(passage))) {
        blocks.aamc_CARS_passages.push(passage.title);
        remainingTime -= passage.time_minutes;
        await this.resourceManager.markResourceAsUsed(passage, 'AAMC', DateUtils.formatDate(date));
      }
    }

    blocks.total_resource_minutes = 240 - remainingTime;

    return {
      date: DateUtils.formatDate(date),
      kind: 'study',
      phase: 3,
      blocks
    };
  }

  private getResourceUid(resource: any): string {
    if (resource.stable_id) {
      return resource.stable_id;
    }
    return `${resource.title.toLowerCase().trim()}+${resource.url}`;
  }

  private getProvider(resource: any): string {
    if (resource.resource_type) {
      if (['Video', 'Article', 'Practice Passage', 'Discrete Practice Question'].includes(resource.resource_type)) {
        return 'Khan Academy';
      }
      if (resource.resource_type === 'CARS Passage') {
        return 'Jack Westin';
      }
      if (['Question Pack', 'Full Length'].includes(resource.resource_type)) {
        return 'AAMC';
      }
    }
    if (resource.high_yield !== undefined) {
      return 'Kaplan';
    }
    if (resource.question_count !== undefined) {
      return 'UWorld';
    }
    return 'Unknown';
  }
}
