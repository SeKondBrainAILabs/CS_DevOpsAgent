/**
 * Event Tracker Service
 * Identifies event producers and consumers in the codebase
 * Supports: EventEmitter, RxJS, Redis Pub/Sub, Kafka, RabbitMQ, Socket.IO
 * Part of the Repository Analysis Engine - Phase 2
 */

import { BaseService } from '../BaseService';
import * as fs from 'fs';
import * as path from 'path';
import type {
  ExtractedEvent,
  EventProducer,
  EventConsumer,
  EventPatternType,
  ParsedAST,
} from '../../../shared/analysis-types';

// Event pattern definitions
interface EventPattern {
  type: EventPatternType;
  producerPatterns: RegExp[];
  consumerPatterns: RegExp[];
}

const EVENT_PATTERNS: EventPattern[] = [
  {
    type: 'eventemitter',
    producerPatterns: [
      /\.emit\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /eventEmitter\.emit\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /this\.emit\s*\(\s*['"`]([^'"`]+)['"`]/g,
    ],
    consumerPatterns: [
      /\.on\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(\w+|async\s*\([^)]*\)\s*=>|\([^)]*\)\s*=>|function)/g,
      /\.once\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(\w+|async\s*\([^)]*\)\s*=>|\([^)]*\)\s*=>|function)/g,
      /\.addListener\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(\w+|async\s*\([^)]*\)\s*=>|\([^)]*\)\s*=>|function)/g,
    ],
  },
  {
    type: 'rxjs',
    producerPatterns: [
      /subject\.next\s*\(/g,
      /\.next\s*\(/g,
      /new\s+(?:Subject|BehaviorSubject|ReplaySubject|AsyncSubject)\s*[<(]/g,
    ],
    consumerPatterns: [
      /\.subscribe\s*\(\s*(\{|\([^)]*\)\s*=>|async\s*\([^)]*\)\s*=>|\w+)/g,
      /\.pipe\s*\([^)]*\)\.subscribe/g,
    ],
  },
  {
    type: 'redis-pubsub',
    producerPatterns: [
      /\.publish\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /redis\.publish\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /client\.publish\s*\(\s*['"`]([^'"`]+)['"`]/g,
    ],
    consumerPatterns: [
      /\.subscribe\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /\.psubscribe\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /redis\.subscribe\s*\(\s*['"`]([^'"`]+)['"`]/g,
    ],
  },
  {
    type: 'kafka',
    producerPatterns: [
      /producer\.send\s*\(\s*\{[^}]*topic\s*:\s*['"`]([^'"`]+)['"`]/g,
      /\.send\s*\(\s*\{[^}]*topic\s*:\s*['"`]([^'"`]+)['"`]/g,
    ],
    consumerPatterns: [
      /consumer\.subscribe\s*\(\s*\{[^}]*topic\s*:\s*['"`]([^'"`]+)['"`]/g,
      /\.subscribe\s*\(\s*\{[^}]*topics?\s*:\s*\[?['"`]([^'"`]+)['"`]/g,
    ],
  },
  {
    type: 'rabbitmq',
    producerPatterns: [
      /channel\.publish\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /channel\.sendToQueue\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /\.publish\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]/g,
    ],
    consumerPatterns: [
      /channel\.consume\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /channel\.bindQueue\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]/g,
    ],
  },
  {
    type: 'socket.io',
    producerPatterns: [
      /socket\.emit\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /io\.emit\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /\.to\s*\([^)]+\)\.emit\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /\.broadcast\.emit\s*\(\s*['"`]([^'"`]+)['"`]/g,
    ],
    consumerPatterns: [
      /socket\.on\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /io\.on\s*\(\s*['"`]([^'"`]+)['"`]/g,
    ],
  },
  {
    type: 'custom',
    producerPatterns: [
      /dispatch\s*\(\s*\{[^}]*type\s*:\s*['"`]([^'"`]+)['"`]/g, // Redux-style
      /bus\.publish\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /eventBus\.emit\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /messageBus\.send\s*\(\s*['"`]([^'"`]+)['"`]/g,
    ],
    consumerPatterns: [
      /bus\.subscribe\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /eventBus\.on\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /messageBus\.receive\s*\(\s*['"`]([^'"`]+)['"`]/g,
    ],
  },
];

export class EventTrackerService extends BaseService {
  constructor() {
    super();
  }

  /**
   * Extract events from a file
   */
  async extractFromFile(filePath: string, ast?: ParsedAST): Promise<ExtractedEvent[]> {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const events: ExtractedEvent[] = [];

    // Detect which event patterns are likely used
    const detectedPatterns = this.detectEventPatterns(content);

    for (const patternType of detectedPatterns) {
      const pattern = EVENT_PATTERNS.find(p => p.type === patternType);
      if (!pattern) continue;

      // Find producers
      for (const producerPattern of pattern.producerPatterns) {
        const regex = new RegExp(producerPattern.source, producerPattern.flags);
        let match;

        while ((match = regex.exec(content)) !== null) {
          const eventName = match[1] || this.inferEventName(match[0]);
          const lineNumber = this.getLineNumber(content, match.index);

          events.push({
            name: eventName,
            patternType,
            file: filePath,
            line: lineNumber,
            isProducer: true,
            isConsumer: false,
          });
        }
      }

      // Find consumers
      for (const consumerPattern of pattern.consumerPatterns) {
        const regex = new RegExp(consumerPattern.source, consumerPattern.flags);
        let match;

        while ((match = regex.exec(content)) !== null) {
          const eventName = match[1] || this.inferEventName(match[0]);
          const handler = match[2] || this.findHandlerName(content, match.index);
          const lineNumber = this.getLineNumber(content, match.index);

          events.push({
            name: eventName,
            patternType,
            file: filePath,
            line: lineNumber,
            isProducer: false,
            isConsumer: true,
            handler,
          });
        }
      }
    }

    // Deduplicate by name + line + producer/consumer
    const seen = new Set<string>();
    const uniqueEvents = events.filter(event => {
      const key = `${event.name}:${event.line}:${event.isProducer}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return uniqueEvents;
  }

  /**
   * Extract events from multiple files
   */
  async extractFromFiles(files: Array<{ path: string; ast?: ParsedAST }>): Promise<ExtractedEvent[]> {
    const allEvents: ExtractedEvent[] = [];

    for (const { path: filePath, ast } of files) {
      try {
        const events = await this.extractFromFile(filePath, ast);
        allEvents.push(...events);
      } catch (error) {
        console.warn(`[EventTrackerService] Failed to extract from ${filePath}:`, error);
      }
    }

    return allEvents;
  }

  /**
   * Get event producers for a specific event
   */
  getProducers(events: ExtractedEvent[], eventName?: string): EventProducer[] {
    const producers = events.filter(e => e.isProducer);

    if (eventName) {
      return producers
        .filter(e => e.name === eventName || e.name.includes(eventName))
        .map(e => ({
          eventName: e.name,
          topic: e.topic,
          file: e.file,
          line: e.line,
          emitCall: `emit('${e.name}')`,
        }));
    }

    return producers.map(e => ({
      eventName: e.name,
      topic: e.topic,
      file: e.file,
      line: e.line,
      emitCall: `emit('${e.name}')`,
    }));
  }

  /**
   * Get event consumers for a specific event
   */
  getConsumers(events: ExtractedEvent[], eventName?: string): EventConsumer[] {
    const consumers = events.filter(e => e.isConsumer);

    if (eventName) {
      return consumers
        .filter(e => e.name === eventName || e.name.includes(eventName))
        .map(e => ({
          eventName: e.name,
          topic: e.topic,
          file: e.file,
          line: e.line,
          handler: e.handler || '<anonymous>',
        }));
    }

    return consumers.map(e => ({
      eventName: e.name,
      topic: e.topic,
      file: e.file,
      line: e.line,
      handler: e.handler || '<anonymous>',
    }));
  }

  /**
   * Build event flow graph (producers -> consumers)
   */
  buildEventFlowGraph(events: ExtractedEvent[]): {
    nodes: Array<{ id: string; type: 'producer' | 'consumer'; file: string; line: number }>;
    edges: Array<{ source: string; target: string; eventName: string }>;
  } {
    const nodes: Array<{ id: string; type: 'producer' | 'consumer'; file: string; line: number }> = [];
    const edges: Array<{ source: string; target: string; eventName: string }> = [];

    // Group by event name
    const eventGroups = new Map<string, { producers: ExtractedEvent[]; consumers: ExtractedEvent[] }>();

    for (const event of events) {
      if (!eventGroups.has(event.name)) {
        eventGroups.set(event.name, { producers: [], consumers: [] });
      }
      const group = eventGroups.get(event.name)!;
      if (event.isProducer) {
        group.producers.push(event);
      } else {
        group.consumers.push(event);
      }
    }

    // Create nodes and edges
    for (const [eventName, group] of Array.from(eventGroups.entries())) {
      for (const producer of group.producers) {
        const producerId = `producer:${producer.file}:${producer.line}`;
        nodes.push({
          id: producerId,
          type: 'producer',
          file: producer.file,
          line: producer.line,
        });

        for (const consumer of group.consumers) {
          const consumerId = `consumer:${consumer.file}:${consumer.line}`;

          // Only add consumer node if not already added
          if (!nodes.find(n => n.id === consumerId)) {
            nodes.push({
              id: consumerId,
              type: 'consumer',
              file: consumer.file,
              line: consumer.line,
            });
          }

          edges.push({
            source: producerId,
            target: consumerId,
            eventName,
          });
        }
      }
    }

    return { nodes, edges };
  }

  /**
   * Detect which event patterns are used in the content
   */
  private detectEventPatterns(content: string): EventPatternType[] {
    const detected: EventPatternType[] = [];

    // EventEmitter
    if (content.includes('EventEmitter') ||
        content.includes('.emit(') ||
        content.includes('.on(') && content.includes('.emit(')) {
      detected.push('eventemitter');
    }

    // RxJS
    if (content.includes('from \'rxjs\'') ||
        content.includes('from "rxjs"') ||
        content.includes('Subject') ||
        content.includes('.subscribe(')) {
      detected.push('rxjs');
    }

    // Redis
    if (content.includes('redis') ||
        content.includes('ioredis') ||
        content.includes('.publish(')) {
      detected.push('redis-pubsub');
    }

    // Kafka
    if (content.includes('kafkajs') ||
        content.includes('kafka-node') ||
        content.includes('Kafka')) {
      detected.push('kafka');
    }

    // RabbitMQ
    if (content.includes('amqplib') ||
        content.includes('amqp') ||
        content.includes('channel.consume') ||
        content.includes('channel.publish')) {
      detected.push('rabbitmq');
    }

    // Socket.IO
    if (content.includes('socket.io') ||
        content.includes('socket.emit') ||
        content.includes('io.emit')) {
      detected.push('socket.io');
    }

    // If no specific pattern detected but has event-like calls, try custom
    if (detected.length === 0 &&
        (content.includes('dispatch(') ||
         content.includes('eventBus') ||
         content.includes('messageBus'))) {
      detected.push('custom');
    }

    return detected;
  }

  /**
   * Get line number from character index
   */
  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }

  /**
   * Infer event name from matched string
   */
  private inferEventName(matchStr: string): string {
    // Try to extract any quoted string
    const quoted = matchStr.match(/['"`]([^'"`]+)['"`]/);
    if (quoted) return quoted[1];

    // If it's an RxJS subject, use a generic name
    if (matchStr.includes('Subject')) return 'rxjs-subject';
    if (matchStr.includes('.next')) return 'rxjs-next';

    return 'unknown-event';
  }

  /**
   * Find handler function name near the match
   */
  private findHandlerName(content: string, matchIndex: number): string | undefined {
    const after = content.slice(matchIndex, matchIndex + 200);

    // Look for function name: .on('event', handlerName)
    const directHandler = after.match(/,\s*(\w+)\s*\)/);
    if (directHandler && !['async', 'function'].includes(directHandler[1])) {
      return directHandler[1];
    }

    // Look for arrow function with named variable
    // const handler = (data) => { ... }
    // .on('event', handler)
    const arrowMatch = after.match(/,\s*(\w+)\s*=>/);
    if (arrowMatch) {
      return arrowMatch[1];
    }

    return undefined;
  }

  /**
   * Get summary statistics for events
   */
  getEventStats(events: ExtractedEvent[]): {
    totalEvents: number;
    uniqueEventNames: number;
    producers: number;
    consumers: number;
    byPatternType: Record<EventPatternType, number>;
    orphanedProducers: string[];
    orphanedConsumers: string[];
  } {
    const producers = events.filter(e => e.isProducer);
    const consumers = events.filter(e => e.isConsumer);
    const producerNames = new Set(producers.map(e => e.name));
    const consumerNames = new Set(consumers.map(e => e.name));

    const orphanedProducers = Array.from(producerNames).filter(name => !consumerNames.has(name));
    const orphanedConsumers = Array.from(consumerNames).filter(name => !producerNames.has(name));

    const byPatternType: Record<EventPatternType, number> = {
      'eventemitter': 0,
      'rxjs': 0,
      'redis-pubsub': 0,
      'kafka': 0,
      'rabbitmq': 0,
      'socket.io': 0,
      'custom': 0,
    };

    for (const event of events) {
      byPatternType[event.patternType]++;
    }

    return {
      totalEvents: events.length,
      uniqueEventNames: new Set(events.map(e => e.name)).size,
      producers: producers.length,
      consumers: consumers.length,
      byPatternType,
      orphanedProducers,
      orphanedConsumers,
    };
  }

  /**
   * Check if a file is likely to contain event handling
   */
  isEventFile(filePath: string): boolean {
    const lower = filePath.toLowerCase();
    const eventIndicators = [
      'event',
      'listener',
      'handler',
      'subscriber',
      'publisher',
      'consumer',
      'producer',
      'socket',
      'pubsub',
      'message',
      'queue',
    ];

    return eventIndicators.some(indicator => lower.includes(indicator));
  }

  /**
   * Get supported file extensions for event tracking
   */
  getSupportedExtensions(): string[] {
    return ['.ts', '.tsx', '.js', '.jsx', '.mjs'];
  }
}
