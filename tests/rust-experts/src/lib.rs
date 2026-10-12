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
    pub mod experts {
        include!("../../../sdks/rust/experts/types.gen.rs");
    }
}
pub use chat::connectors::{broker_generated, generated, selection_generated};

#[cfg(test)]
mod tests {
    use super::chat::experts as e;
    use serde_json::{json, Value};
    fn fixture() -> Value {
        serde_json::from_str(include_str!("../../../fixtures/experts/normal-wire.json")).unwrap()
    }
    #[test]
    fn private_and_native_normal_frames_keep_scope_and_snapshot() {
        let f = fixture();
        let r: e::PrivateGrantRequest =
            serde_json::from_value(f["PrivateGrantRequest"].clone()).unwrap();
        assert_eq!(
            r.payload.submission.submission.snapshot.turn_operation_id,
            r.payload.submission.expert_snapshot.turn_operation_id
        );
        serde_json::from_value::<e::ApplyRequest>(f["ApplyRequest"].clone()).unwrap();
        serde_json::from_value::<e::SubmissionReadResponse>(f["SubmissionReadResponse"].clone())
            .unwrap();
        serde_json::from_value::<e::NativeSubmitRequest>(f["NativeSubmitRequest"].clone()).unwrap();
        serde_json::from_value::<e::BindingSetResponse>(f["BindingSetResponse"].clone()).unwrap();
        assert_eq!(format!("{r:?}"), "PrivateGrantRequest([redacted])");
    }
    #[test]
    fn ordinary_selection_requires_explicit_null_and_unknown_is_not_retryable() {
        let f = fixture();
        let mut change = f["BindingSetRequest"].clone();
        change["payload"]["expert"] = Value::Null;
        serde_json::from_value::<e::BindingSetRequest>(change.clone()).unwrap();
        change["payload"].as_object_mut().unwrap().remove("expert");
        assert!(serde_json::from_value::<e::BindingSetRequest>(change).is_err());
        let mut error = f["Error"].clone();
        error["retryable"] = json!(true);
        assert!(serde_json::from_value::<e::Error>(error).is_err());
    }
    #[test]
    fn digest_vectors_match_canonical_snapshot_and_utf8_knowledge() {
        let vectors: Value = serde_json::from_str(include_str!(
            "../../../fixtures/experts/digest-vectors.json"
        ))
        .unwrap();
        for v in vectors.as_array().unwrap() {
            let expert: Option<e::ExpertRef> = serde_json::from_value(v["expert"].clone()).unwrap();
            let s = e::freeze_snapshot(
                v["turnOperationId"].as_str().unwrap().into(),
                v["bindingRevision"].as_i64().unwrap(),
                expert,
            )
            .unwrap();
            assert_eq!(s.snapshot_digest, v["snapshotDigest"].as_str().unwrap());
            s.validate().unwrap();
        }
        let vectors: Value = serde_json::from_str(include_str!(
            "../../../fixtures/experts/knowledge-digest-vectors.json"
        ))
        .unwrap();
        for v in vectors.as_array().unwrap() {
            let mut resources: Vec<e::KnowledgeResource> =
                serde_json::from_value(v["resources"].clone()).unwrap();
            assert_eq!(
                e::canonical_knowledge_manifest_bytes(&resources).unwrap(),
                v["canonicalText"].as_str().unwrap().as_bytes()
            );
            resources.reverse();
            assert_eq!(
                e::knowledge_manifest_digest(&resources).unwrap(),
                v["digest"].as_str().unwrap()
            );
        }
    }
}
