// Event Timeline types — chronological operational log of transformer events

export type TimelineEventType =
  | 'alert'          // alert from anomaly/FMEA engine
  | 'health_drop'    // health score fell by >3 pts
  | 'scenario'       // fault scenario stage changed
  | 'cascade'        // thermal→arcing cascade triggered
  | 'operator'       // operator action applied
  | 'connection'     // WebSocket connected/disconnected

export type TimelineSeverity = 'info' | 'caution' | 'warning' | 'critical'

export interface TimelineEvent {
  id: number              // monotonically increasing, used as React key
  simTime: number         // sim-time seconds when event occurred
  wallTime: string        // ISO timestamp (real wall clock)
  type: TimelineEventType
  severity: TimelineSeverity
  title: string
  detail: string          // one-sentence explanation
}
