#![forbid(unsafe_code)]
pub mod generated {
    include!("../../../sdks/rust/market-connectors/types.gen.rs");
}
pub mod selection_generated {
    include!("../../../sdks/rust/market-selection/portable.gen.rs");
}
pub mod broker_generated {
    include!("../../../sdks/rust/market-broker-control/types.gen.rs");
}

#[cfg(test)]
mod tests {
    use super::broker_generated::*;
    use serde_json::{json, Value};

    fn fixtures() -> Value {
        serde_json::from_str(include_str!(
            "../../../fixtures/market-broker-control/normal-wire.json"
        ))
        .unwrap()
    }

    #[test]
    fn all_eight_requests_use_strict_generated_types() {
        for (name, value) in fixtures().as_object().unwrap() {
            if !name.ends_with("Request") {
                continue;
            }
            let request: Request = serde_json::from_value(value.clone()).unwrap();
            assert_eq!(request.request_id(), value["requestId"].as_str().unwrap());
            let mut future = value.clone();
            future["payload"]["futureField"] = json!(true);
            assert!(serde_json::from_value::<Request>(future).is_err(), "{name}");
        }
    }

    #[test]
    fn responses_have_typed_facts_and_portable_snapshot_validation() {
        let v = fixtures();
        serde_json::from_value::<InitializeResponse>(v["InitializeResponse"].clone()).unwrap();
        let mut prepared: PrepareResponse =
            serde_json::from_value(v["PrepareResponse"].clone()).unwrap();
        serde_json::from_value::<BindTurnResponse>(v["BindTurnResponse"].clone()).unwrap();
        serde_json::from_value::<RevokeResponse>(v["RevokeResponse"].clone()).unwrap();
        serde_json::from_value::<StatusResponse>(v["StatusResponse"].clone()).unwrap();
        serde_json::from_value::<PendingCallResponse>(v["PendingCallResponse"].clone()).unwrap();
        serde_json::from_value::<DecideCallResponse>(v["DecideCallResponse"].clone()).unwrap();
        serde_json::from_value::<ShutdownResponse>(v["ShutdownResponse"].clone()).unwrap();
        prepared.data.snapshot.selection_digest = "0".repeat(64);
        assert!(prepared.validate().is_err());
    }

    #[test]
    fn response_future_fields_are_discarded_and_debug_is_redacted() {
        let mut value = fixtures()["InitializeResponse"].clone();
        value["futureField"] = json!("ordinary future observation");
        let parsed: InitializeResponse = serde_json::from_value(value).unwrap();
        assert_eq!(format!("{parsed:?}"), "InitializeResponse([redacted])");
        assert!(serde_json::to_value(parsed)
            .unwrap()
            .get("futureField")
            .is_none());
        let mut pending = fixtures()["PrepareResponse"].clone();
        pending["data"]["nativeTurnId"] = Value::Null;
        assert!(serde_json::from_value::<PrepareResponse>(pending).is_err());
    }

    #[test]
    fn shared_snapshot_vectors_match_existing_source_helpers() {
        let vectors: Vec<Value> = serde_json::from_str(include_str!(
            "../../../fixtures/market-selection/digest-vectors.json"
        ))
        .unwrap();
        for v in vectors {
            let refs = serde_json::from_value(v["selection"].clone()).unwrap();
            let snapshot = super::selection_generated::freeze_selection(
                v["turnOperationId"].as_str().unwrap().into(),
                refs,
            )
            .unwrap();
            assert_eq!(snapshot.selection_digest, v["selectionDigest"]);
            snapshot.validate().unwrap();
        }
    }

    #[test]
    fn metadata_is_only_the_exact_owned_locator_fragment() {
        let v = fixtures();
        serde_json::from_value::<ElicitationMetadata>(v["ElicitationMetadata"].clone()).unwrap();
        let mut other = v["ElicitationMetadata"].clone();
        other["yijieKind"] = json!("other");
        assert!(serde_json::from_value::<ElicitationMetadata>(other).is_err());
        for port in ["0", "65536", "00080"] {
            let mut response = v["InitializeResponse"].clone();
            response["data"]["gatewayUrl"] = json!(format!("http://127.0.0.1:{port}/mcp"));
            assert!(serde_json::from_value::<InitializeResponse>(response).is_err());
        }
    }

    #[test]
    fn new_thread_null_is_required_and_bound_ids_freeze_together() {
        let mut fresh = fixtures()["PrepareRequest"].clone();
        fresh["payload"]["context"]["nativeThreadId"] = Value::Null;
        let request: PrepareRequest = serde_json::from_value(fresh.clone()).unwrap();
        assert!(request.payload.context.native_thread_id.is_none());
        assert!(
            serde_json::to_value(request).unwrap()["payload"]["context"]["nativeThreadId"]
                .is_null()
        );
        fresh["payload"]["context"]
            .as_object_mut()
            .unwrap()
            .remove("nativeThreadId");
        assert!(serde_json::from_value::<PrepareRequest>(fresh).is_err());
        let mut bound: BindTurnResponse =
            serde_json::from_value(fixtures()["BindTurnResponse"].clone()).unwrap();
        bound.data.bound_native_thread_id = None;
        assert!(bound.validate().is_err());
        bound.data.bound_native_thread_id = Some("different-ordinary-thread".into());
        assert!(bound.validate().is_err());
    }
}
