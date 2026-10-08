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
    }
}
#[cfg(test)]
mod tests {
    use super::chat::connectors::selection_generated::*;
    use serde_json::{json, Value};
    const ID: &str = "00000000-0000-4000-8000-000000000157";
    fn request() -> Value {
        json!({"schemaVersion":1,"requestId":ID,"contextId":ID,"payload":{"operationId":ID,"projectId":null,"contentBlocks":[{"type":"text","text":"普通本地输入"}],"intent":{"profileId":"minimax-m3-high-v1","expectedRevision":0},"selection":[]}})
    }
    #[test]
    fn vectors_match_shared_bytes_and_digest() {
        let vectors: Vec<Value> = serde_json::from_str(include_str!(
            "../../../fixtures/market-selection/digest-vectors.json"
        ))
        .unwrap();
        for v in vectors {
            let refs: Vec<SelectionRef> = serde_json::from_value(v["selection"].clone()).unwrap();
            let op = v["turnOperationId"].as_str().unwrap();
            assert_eq!(
                canonical_selection_bytes(op, &refs).unwrap(),
                v["canonicalText"].as_str().unwrap().as_bytes()
            );
            assert_eq!(selection_digest(op, &refs).unwrap(), v["selectionDigest"]);
            let snapshot = freeze_selection(op.into(), refs).unwrap();
            snapshot.validate().unwrap();
            let encoded = serde_json::to_value(snapshot).unwrap();
            serde_json::from_value::<SelectionSnapshot>(encoded).unwrap();
        }
    }
    #[test]
    fn native_submission_distinguishes_missing_null_and_existing_target() {
        serde_json::from_value::<SubmitRequest>(request()).unwrap();
        let mut missing = request();
        missing["payload"]
            .as_object_mut()
            .unwrap()
            .remove("projectId");
        assert!(serde_json::from_value::<SubmitRequest>(missing).is_err());
        let mut existing = request();
        existing["payload"]["sessionId"] = json!(ID);
        serde_json::from_value::<SubmitRequest>(existing.clone()).unwrap();
        existing["payload"]["projectId"] = json!(ID);
        assert!(serde_json::from_value::<SubmitRequest>(existing).is_err());
        let mut nullable = request();
        nullable["payload"]["sessionId"] = Value::Null;
        assert!(serde_json::from_value::<SubmitRequest>(nullable).is_err());
    }
    #[test]
    fn unique_installation_and_canonical_snapshot_rules() {
        let a: SelectionRef =
            serde_json::from_value(json!({"installationId":ID,"revision":1,"generation":1}))
                .unwrap();
        let mut b = a.clone();
        b.revision = 2;
        assert!(validate_selection(&[a.clone(), b]).is_err());
        let mut snapshot = freeze_selection(ID.into(), vec![a]).unwrap();
        snapshot.selection_digest = "0".repeat(64);
        assert!(snapshot.validate().is_err());
        assert!(canonical_selection_bytes("00000000-0000-0000-0000-000000000000", &[]).is_err());
    }
    #[test]
    fn attachment_limit_and_closed_request() {
        let mut too_many = request();
        too_many["payload"]["contentBlocks"] =
            json!(vec![json!({"type":"file","attachmentId":ID}); 11]);
        assert!(serde_json::from_value::<SubmitRequest>(too_many).is_err());
        let mut normal = request();
        normal["payload"]["contentBlocks"] =
            json!([{"type":"image","attachmentId":ID},{"type":"file","attachmentId":ID}]);
        serde_json::from_value::<SubmitRequest>(normal.clone()).unwrap();
        normal["payload"]["futureField"] = json!(1);
        assert!(serde_json::from_value::<SubmitRequest>(normal).is_err());
    }
    #[test]
    fn receipt_means_native_durable_acceptance_only() {
        let digest = selection_digest(ID, &[]).unwrap();
        let mut v = json!({"outcome":"local_durable_accepted","sessionId":ID,"localTurnId":ID,"submissionOperationId":ID,"turnOperationId":ID,"selectionDigest":digest,"futureField":1});
        let accepted: SubmissionReceipt = serde_json::from_value(v.clone()).unwrap();
        assert!(serde_json::to_value(accepted)
            .unwrap()
            .get("futureField")
            .is_none());
        v["outcome"] = json!("runtime_accepted");
        assert!(serde_json::from_value::<SubmissionReceipt>(v).is_err());
        serde_json::from_value::<Error>(
            json!({"schemaVersion":1,"code":"invalid_request","retryable":false}),
        )
        .unwrap();
        assert!(serde_json::from_value::<Error>(
            json!({"schemaVersion":1,"requestId":null,"code":"invalid_request","retryable":false})
        )
        .is_err());
    }
}
