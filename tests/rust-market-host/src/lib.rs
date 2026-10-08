#![forbid(unsafe_code)]
pub mod chat {
    pub mod models_generated {
        include!("../../../sdks/rust/chat-models/types.gen.rs");
    }
    pub mod connectors {
        pub mod generated {
            include!("../../../sdks/rust/market-connectors/types.gen.rs");
        }
        pub mod selection_generated {
            include!("../../../sdks/rust/market-selection/types.gen.rs");
        }
        pub mod broker_generated {
            include!("../../../sdks/rust/market-broker-control/types.gen.rs");
        }
        pub mod provider_generated {
            include!("../../../sdks/rust/market-provider/types.gen.rs");
        }
        pub mod host_generated {
            include!("../../../sdks/rust/market-host/types.gen.rs");
        }
    }
}
pub use chat::connectors::{broker_generated, generated, selection_generated};

#[cfg(test)]
mod tests {
    use super::chat::connectors::{host_generated as host, provider_generated as provider};
    use serde_json::{json, Value};
    fn fixtures() -> Value {
        serde_json::from_str(include_str!(
            "../../../fixtures/market-host/normal-wire.json"
        ))
        .unwrap()
    }
    #[test]
    fn full_native_grant_uses_original_snapshot_model_and_v2_blocks() {
        let value = fixtures();
        let request: host::GrantRegisterRequest =
            serde_json::from_value(value["GrantRegisterRequest"].clone()).unwrap();
        assert!(request.payload.submission.agent_session_id.is_none());
        assert_eq!(request.payload.submission.intent.expected_revision, 0);
        assert_eq!(
            request.payload.submission.services[0].credential_ref,
            value["AuthBeginRequest"]["payload"]["binding"]["credentialRef"]
        );
        let mut extra = value["GrantRegisterRequest"].clone();
        extra["payload"]["submission"]["contentBlocks"][0]["futureField"] = json!(true);
        assert!(serde_json::from_value::<host::GrantRegisterRequest>(extra).is_err());
        assert_eq!(format!("{request:?}"), "GrantRegisterRequest([redacted])");
    }
    #[test]
    fn daily_arguments_are_closed_and_preserve_upstream_field_names() {
        for code in ["000001.SZ", "600000.SH", "920001.BJ"] {
            for day in ["00010101", "20000229", "20240229", "20260105", "99991231"] {
                let input = json!({"ts_code":code,"trade_date":day});
                let args: provider::TushareDailyArguments =
                    serde_json::from_value(input.clone()).unwrap();
                assert!(args.validate().is_ok());
                assert_eq!(serde_json::to_value(args).unwrap(), input);
            }
        }
        for input in [
            json!({"ts_code":"000001.SZ"}),
            json!({"ts_code":"000001.SZ","trade_date":"20260105","fields":"close"}),
            json!({"ts_code":"000001.SZ,600000.SH","trade_date":"20260105"}),
        ] {
            assert!(serde_json::from_value::<provider::TushareDailyArguments>(input).is_err());
        }
        assert_eq!(provider::TUSHARE_DAILY_PROFILE, "tushare-daily-v1");
        assert_eq!(provider::TUSHARE_DAILY_TOOL_NAME, "tushare_daily");
        assert_eq!(provider::TUSHARE_DAILY_MAX_ROWS, 1);
        assert_eq!(provider::TUSHARE_DAILY_MAX_CALLS_PER_APPROVAL, 1);
        let schema: Value =
            serde_json::from_str(provider::TUSHARE_DAILY_INPUT_SCHEMA_JSON).unwrap();
        assert_eq!(schema["additionalProperties"], false);
        assert_eq!(schema["properties"].as_object().unwrap().len(), 2);
        let output: Value =
            serde_json::from_str(provider::TUSHARE_DAILY_OUTPUT_SCHEMA_JSON).unwrap();
        let rows = &output["properties"][provider::TUSHARE_DAILY_RESULT_ROWS_FIELD];
        assert_eq!(rows["maxItems"], 1);
        assert_eq!(
            rows["items"]["required"],
            json!(["ts_code", "trade_date", "close"])
        );
        assert_eq!(rows["items"]["additionalProperties"], false);
        assert_eq!(
            provider::TUSHARE_DAILY_RESULT_REQUIRED_NUMERIC_FIELDS,
            ["close"]
        );
    }
    #[test]
    fn daily_dates_follow_a_full_gregorian_cycle() {
        for day in [
            "00000101", "19000229", "21000229", "20250229", "20260230", "20260431", "20260001",
            "20260100", "20261301",
        ] {
            assert!(provider::TushareDailyArguments {
                ts_code: "000001.SZ".into(),
                trade_date: day.into()
            }
            .validate()
            .is_err());
        }
        for year in 2000_u32..2400 {
            let args = provider::TushareDailyArguments {
                ts_code: "600000.SH".into(),
                trade_date: format!("{year:04}0229"),
            };
            let leap =
                year.is_multiple_of(4) && (!year.is_multiple_of(100) || year.is_multiple_of(400));
            assert_eq!(args.validate().is_ok(), leap);
        }
    }
    #[test]
    fn nonempty_selection_requires_ask_while_empty_keeps_original_modes() {
        let mut v = fixtures()["GrantRegisterRequest"].clone();
        v["payload"]["submission"]["permissionMode"] = json!("full");
        assert!(serde_json::from_value::<host::GrantRegisterRequest>(v.clone()).is_err());
        let submission = &mut v["payload"]["submission"];
        let snapshot = super::selection_generated::freeze_selection(
            submission["snapshot"]["turnOperationId"]
                .as_str()
                .unwrap()
                .into(),
            vec![],
        )
        .unwrap();
        submission["snapshot"] = serde_json::to_value(snapshot).unwrap();
        submission["services"] = json!([]);
        serde_json::from_value::<host::GrantRegisterRequest>(v).unwrap();
    }
    #[test]
    fn native_ui_cannot_supply_scope_and_unmanaged_observation_needs_no_host_ids() {
        let v = fixtures();
        serde_json::from_value::<host::NativeObserveResponse>(v["NativeObserveResponse"].clone())
            .unwrap();
        let mut decision = v["NativeApprovalDecideRequest"].clone();
        decision["payload"]["scope"] = v["GrantRegisterRequest"]["payload"]["scope"].clone();
        assert!(serde_json::from_value::<host::NativeApprovalDecideRequest>(decision).is_err());
        let mut error = v["NativeError"].clone();
        error["code"] = json!("keyring_unavailable");
        serde_json::from_value::<host::NativeError>(error).unwrap();
    }
    #[test]
    fn provider_authorization_and_execution_readiness_are_separate() {
        let v = fixtures();
        serde_json::from_value::<provider::AuthBeginRequest>(v["AuthBeginRequest"].clone())
            .unwrap();
        let mut status = v["AuthBeginResponse"].clone();
        status["data"]["authorizationStatus"] = json!("authorized");
        status["data"]["operationState"] = json!("succeeded");
        serde_json::from_value::<provider::AuthBeginResponse>(status.clone()).unwrap();
        status["data"]["executionAvailable"] = json!(true);
        assert!(serde_json::from_value::<provider::AuthBeginResponse>(status).is_err());
        let mut url = v["AuthBeginResponse"].clone();
        url["data"]["authorizationUrl"] = json!("https://example.invalid/authorize");
        assert!(serde_json::from_value::<provider::AuthBeginResponse>(url.clone()).is_err());
        url["data"]["operationState"] = json!("awaiting_user");
        serde_json::from_value::<provider::AuthBeginResponse>(url).unwrap();
    }
    #[test]
    fn http_trigger_cannot_mutate_registered_intent() {
        let mut v = fixtures()["SubmitRequest"].clone();
        serde_json::from_value::<host::SubmitRequest>(v.clone()).unwrap();
        v["payload"]["permissionMode"] = json!("full");
        assert!(serde_json::from_value::<host::SubmitRequest>(v).is_err());
    }
}
