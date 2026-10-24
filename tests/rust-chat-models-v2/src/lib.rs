#![forbid(unsafe_code)]
pub mod generated {
    include!("../../../sdks/rust/chat-models-v2/types.gen.rs");
}

#[cfg(test)]
mod tests {
    use super::generated::*;
    use serde_json::json;

    #[test]
    fn active_request_does_not_accept_a_retired_identity() {
        let mut value = json!({"schema_version":2,"operation_id":"00000000-0000-4000-8000-000000000164","expected_revision":7,"profile_id":"kimi-k3-1-pro-max-v1"});
        let request: SelectRequest = serde_json::from_value(value.clone()).unwrap();
        assert_eq!(serde_json::to_value(request).unwrap(), value);
        value["profile_id"] = json!("kimi-k3-max-v1");
        assert!(serde_json::from_value::<SelectRequest>(value).is_err());
    }

    #[test]
    fn legacy_receipt_round_trip_preserves_the_original_identity() {
        let value = json!({"schema_version":2,"agent_session_id":"00000000-0000-4000-8000-000000000164","operation_id":"00000000-0000-4000-8000-000000000165","state":"committed","request":{"schema_version":1,"operation_id":"00000000-0000-4000-8000-000000000165","expected_revision":6,"profile_id":"kimi-k3-max-v1"},"result":{"schema_version":1,"agent_session_id":"00000000-0000-4000-8000-000000000164","state":"ready","revision":7,"profile_id":"kimi-k3-max-v1"}});
        let receipt: ModelOperationReceipt = serde_json::from_value(value.clone()).unwrap();
        assert_eq!(serde_json::to_value(receipt).unwrap(), value);
    }
}
