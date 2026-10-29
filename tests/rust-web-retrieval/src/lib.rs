#![forbid(unsafe_code)]
include!("../../../sdks/rust/web-retrieval/types.gen.rs");

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn search_input_defaults_and_closed_character_limits() {
        let input: SearchArguments =
            serde_json::from_value(json!({"query":"ordinary query"})).unwrap();
        assert_eq!(input.effective_limit(), 5);
        input.validate().unwrap();
        for limit in [1, 20] {
            let input: SearchArguments =
                serde_json::from_value(json!({"query":"文".repeat(2048),"limit":limit})).unwrap();
            assert_eq!(input.effective_limit(), limit);
        }
        for input in [
            json!({"query":""}),
            json!({"query":"  "}),
            json!({"query":"文".repeat(2049)}),
            json!({"query":"normal","limit":null}),
            json!({"query":"normal","limit":21}),
            json!({"query":"normal","extra":true}),
        ] {
            assert!(serde_json::from_value::<SearchArguments>(input).is_err());
        }
    }

    #[test]
    fn fetch_input_and_output_validate_and_preserve_markdown() {
        let input: FetchArguments =
            serde_json::from_value(json!({"url":"https://example.org/page"})).unwrap();
        input.validate().unwrap();
        assert!(
            serde_json::from_value::<FetchArguments>(json!({"url":"ftp://example.org/page"}))
                .is_err()
        );
        assert!(serde_json::from_value::<FetchArguments>(
            json!({"url":"https://example.org/page","extra":1})
        )
        .is_err());
        let body = json!({"url":input.url,"title":"Example","markdown":"# Original\n\nBody","truncated":true});
        let output: FetchOutput = serde_json::from_value(body.clone()).unwrap();
        output.validate().unwrap();
        assert_eq!(serde_json::to_value(output).unwrap(), body);
        assert!(serde_json::from_value::<FetchSuccess>(json!({"url":"https://example.org/page","title":"Example","markdown":"  ","truncated":false})).is_err());
    }

    #[test]
    fn list_empty_success_and_error_are_distinct() {
        let output: SearchOutput =
            serde_json::from_value(json!({"results":[],"truncated":false})).unwrap();
        assert!(matches!(output, SearchOutput::SearchSuccess(_)));
        let error = ErrorOutput::new(ErrorCode::NoContent);
        error.validate().unwrap();
        let value = serde_json::to_value(&error).unwrap();
        assert!(matches!(
            serde_json::from_value::<FetchOutput>(value.clone()).unwrap(),
            FetchOutput::ErrorOutput(_)
        ));
        let mut mismatched = value;
        mismatched["error"]["message"] = json!("unrecognized provider message");
        assert!(serde_json::from_value::<ErrorOutput>(mismatched).is_err());
        assert_eq!(error.error.message, ErrorCode::NoContent.safe_message());
    }

    #[test]
    fn descriptors_and_budgets_are_generated_from_same_source() {
        let descriptors: serde_json::Value = serde_json::from_str(TOOLS_JSON).unwrap();
        assert_eq!(descriptors[0]["name"], SEARCH_TOOL_NAME);
        assert_eq!(descriptors[2]["name"], FETCH_TOOL_NAME);
        assert_eq!(
            descriptors[0]["inputSchema"],
            serde_json::from_str::<serde_json::Value>(SEARCH_INPUT_SCHEMA_JSON).unwrap()
        );
        assert_eq!(
            descriptors[2]["outputSchema"],
            serde_json::from_str::<serde_json::Value>(FETCH_OUTPUT_SCHEMA_JSON).unwrap()
        );
        assert_eq!(MAX_RESULT_BYTES, 65536);
        assert_eq!(MAX_RESPONSE_BYTES, 1048576);
        assert_eq!(SEARCH_PATH, "/v1/tools/search");
        assert_eq!(FETCH_PATH, "/v1/tools/fetch");
    }
    #[test]
    fn pro_calendar_and_optional_content_are_validated_by_generated_types() {
        for window in [json!({"start":"2024-02-29","end":"2026-10"}),json!({"start":"2026"}),json!({})] {
            let p:ProArguments=serde_json::from_value(json!({"query":"docs","time_window":window})).unwrap();p.validate().unwrap();
        }
        for window in [json!({"start":"2025-02-29"}),json!({"end":"2026-13"}),json!({"start":"2026-10","end":"2026-09"}),json!({"start":"0000"}),json!({"start":null})] {
            assert!(serde_json::from_value::<ProArguments>(json!({"query":"docs","time_window":window})).is_err());
        }
        let input:SearchArguments=serde_json::from_value(json!({"query":"docs","include_content":true})).unwrap();assert_eq!(input.include_content,Some(true));
        assert!(serde_json::from_value::<SearchArguments>(json!({"query":"docs","include_content":null})).is_err());
        let legacy:serde_json::Value=serde_json::from_str(LEGACY_TOOLS_JSON).unwrap();assert_eq!(legacy.as_array().unwrap().len(),2);
    }

}
