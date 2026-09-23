export interface paths {
    "/v1/agent-sessions/{agent_session_id}/turns/{runtime_turn_id}/timing": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read timing facts for one exactly bound native turn
         * @description No body or query. At most 1024 turns and 8 MiB decoded history, bounded by the existing 16 MiB RPC transport and a 3 second deadline. No start, resume, submission, approval or Store write. Historical missing values are unknown.
         */
        get: operations["readNativeTurnTiming"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /**
         * Format: uuid
         * @description Canonical non-zero UUID; identity is checked against the managed mapping.
         */
        CanonicalID: string;
        /** @enum {string} */
        TimeFieldState: "known" | "unknown" | "invalid";
        /** @description Runtime Unix seconds, not local receipt/schedule time. Omitted/null native field is unknown; malformed or out-of-range is invalid. Zero is valid. */
        UnixSecondsFact: {
            state: components["schemas"]["TimeFieldState"];
            /** Format: int64 */
            value?: number;
        };
        /** @description Runtime whole-turn elapsed milliseconds, including its waits. Not item/model-only time and not derived from integer seconds. */
        DurationMsFact: {
            state: components["schemas"]["TimeFieldState"];
            /** Format: int64 */
            value?: number;
        };
        /** @enum {string} */
        TimingSource: "runtime_read";
        NativeTurnTiming: {
            /** @enum {integer} */
            schema_version: 1;
            agent_session_id: components["schemas"]["CanonicalID"];
            thread_id: components["schemas"]["CanonicalID"];
            turn_id: components["schemas"]["CanonicalID"];
            source: components["schemas"]["TimingSource"];
            started_at: components["schemas"]["UnixSecondsFact"];
            completed_at: components["schemas"]["UnixSecondsFact"];
            duration_ms: components["schemas"]["DurationMsFact"];
        };
        /** @enum {string} */
        TimingErrorCode: "invalid_request" | "unauthorized" | "session_not_found" | "turn_not_found" | "native_timing_unavailable" | "native_timing_timeout" | "native_timing_identity_mismatch" | "native_timing_limit_exceeded";
        TimingError: {
            error: {
                code: components["schemas"]["TimingErrorCode"];
                message: string;
            };
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    readNativeTurnTiming: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                agent_session_id: components["schemas"]["CanonicalID"];
                runtime_turn_id: components["schemas"]["CanonicalID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Exact native turn clock only; no execution or lifecycle authority. */
            200: {
                headers: {
                    /** @description Never cache timing transport responses. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["NativeTurnTiming"];
                };
            };
            /** @description Invalid IDs or unexpected query/body */
            400: {
                headers: {
                    /** @description Never cache timing transport responses. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TimingError"];
                };
            };
            /** @description Owner-only bearer required */
            401: {
                headers: {
                    /** @description Never cache timing transport responses. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TimingError"];
                };
            };
            /** @description Current session or exact turn not found; no inference about prior execution */
            404: {
                headers: {
                    /** @description Never cache timing transport responses. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TimingError"];
                };
            };
            /** @description Native history unavailable, timeout, mismatch or bounded read limit */
            503: {
                headers: {
                    /** @description Never cache timing transport responses. */
                    "Cache-Control"?: "no-store";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TimingError"];
                };
            };
        };
    };
}
