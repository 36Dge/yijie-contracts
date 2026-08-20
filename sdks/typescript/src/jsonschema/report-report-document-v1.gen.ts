/* Generated from JSON Schema. Do not edit by hand. */

export type Section = (SummarySection | MetricsSection | ParagraphSection | TableSection | ChartSection | CalloutSection | UnknownOptionalSection)
export type SafeText = string
export type TableScalar = (string | number | boolean | null)

/**
 * Closed local report document. Known sections are decoded strictly. An unknown section is retained as opaque JSON only when required=false, so a renderer can skip it without evaluating markup, URLs, or code.
 */
export interface ReportDocumentV1 {
schema_version: 1
title: string
generated_at: string
source_time?: string
/**
 * @maxItems 64
 */
sections: Section[]
}
export interface SummarySection {
id: string
type: "summary"
required: boolean
payload: {
heading?: SafeText
text: SafeText
}
}
export interface MetricsSection {
id: string
type: "metrics"
required: boolean
payload: {
/**
 * @minItems 1
 * @maxItems 32
 */
items: [{
label: string
value: (number | string)
unit?: string
}, ...({
label: string
value: (number | string)
unit?: string
})[]]
}
}
export interface ParagraphSection {
id: string
type: "paragraph"
required: boolean
payload: {
heading?: SafeText
text: SafeText
}
}
export interface TableSection {
id: string
type: "table"
required: boolean
payload: {
caption?: SafeText
/**
 * @minItems 1
 * @maxItems 32
 */
columns: [{
key: string
label: string
}, ...({
key: string
label: string
})[]]
/**
 * @maxItems 1000
 */
rows: {
[k: string]: TableScalar
}[]
}
}
export interface ChartSection {
id: string
type: "chart"
required: boolean
payload: {
title?: SafeText
chart_type: ("bar" | "line" | "pie")
/**
 * @minItems 1
 * @maxItems 128
 */
labels: [string, ...(string)[]]
/**
 * @minItems 1
 * @maxItems 16
 */
series: [{
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}]|[{
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}]|[{
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}]|[{
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}]|[{
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}]|[{
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}]|[{
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}]|[{
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}]|[{
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}]|[{
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}]|[{
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}]|[{
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}]|[{
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}]|[{
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}]|[{
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}]|[{
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}, {
name: string
/**
 * @minItems 1
 * @maxItems 128
 */
values: [number, ...(number)[]]
}]
}
}
export interface CalloutSection {
id: string
type: "callout"
required: boolean
payload: {
tone: ("info" | "success" | "warning" | "error")
title?: SafeText
text: SafeText
}
}
/**
 * An optional unknown section is opaque storage only. Consumers must not traverse or render payload content.
 */
export interface UnknownOptionalSection {
id: string
type: string
required: false
payload: {
[k: string]: unknown
}
}
