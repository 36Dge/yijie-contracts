#![forbid(unsafe_code)]
include!("../../../sdks/rust/market-connectors/types.gen.rs");

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{json, Value};
    const ID: &str = "00000000-0000-4000-8000-000000000157";
    const CONTEXT: &str = "00000000-0000-4000-8000-000000000158";
    fn envelope(payload: Value) -> Value {
        json!({"schemaVersion":1,"requestId":ID,"contextId":CONTEXT,"payload":payload})
    }
    #[test]
    fn required_context_and_positive_revision() {
        let mut value = envelope(
            json!({"installationId":ID,"operationId":CONTEXT,"expectedRevision":1,"desiredEnabled":false}),
        );
        let request: SetEnabledRequest = serde_json::from_value(value.clone()).unwrap();
        assert_eq!(request.payload.expected_revision, 1);
        value["payload"]["expectedRevision"] = json!(0);
        assert!(serde_json::from_value::<SetEnabledRequest>(value).is_err());
        let mut missing = envelope(json!({}));
        missing.as_object_mut().unwrap().remove("contextId");
        assert!(serde_json::from_value::<SnapshotRequest>(missing).is_err());
    }
    #[test]
    fn closed_request_and_non_null_optional() {
        let mut request = envelope(json!({}));
        request["futureRevision"] = json!(1);
        assert!(serde_json::from_value::<SnapshotRequest>(request).is_err());
        assert!(serde_json::from_value::<Error>(json!({"schemaVersion":1,"requestId":null,"code":"execution_unavailable","retryable":false})).is_err());
        assert!(serde_json::from_value::<Error>(
            json!({"schemaVersion":1,"code":"execution_unavailable","retryable":false})
        )
        .is_ok());
    }
    #[test]
    fn unknown_response_fields_are_dropped_but_enums_not_permitted() {
        let value = json!({"schemaVersion":1,"code":"execution_unavailable","retryable":false,"futureRevision":1});
        let response: Error = serde_json::from_value(value).unwrap();
        assert!(serde_json::to_value(response)
            .unwrap()
            .get("futureRevision")
            .is_none());
        assert!(serde_json::from_value::<Error>(
            json!({"schemaVersion":1,"code":"future_error","retryable":false})
        )
        .is_err());
    }
    #[test]
    fn selection_references_require_non_nil_uuids_and_bounds() {
        for value in [
            json!({"installationId":"00000000-0000-0000-0000-000000000000","revision":1,"generation":1}),
            json!({"installationId":ID,"revision":1,"generation":0}),
            json!({"installationId":ID,"revision":9007199254740992_i64,"generation":1}),
        ] {
            assert!(serde_json::from_value::<SelectionRef>(value).is_err());
        }
    }
    #[test]
    fn worker_status_cannot_claim_an_unqualified_policy_is_active() {
        let mut policy = json!({"mcpLibrary":"codex-rmcp-client","oauthStore":"keyring_only","credentialBoundary":"connectors_only","stdioShutdown":"eof_only","externalCallsEnabled":false});
        assert!(serde_json::from_value::<WorkerLibraryPolicy>(policy.clone()).is_ok());
        policy["externalCallsEnabled"] = json!(true);
        assert!(serde_json::from_value::<WorkerLibraryPolicy>(policy).is_err());
    }
    #[test]
    fn local_authorization_capability_defaults_false_without_qualifying_tools() {
        let original = json!({"serviceId":"synthetic-service","serverName":"synthetic-service","displayName":"Synthetic","categoryId":"productivity","categoryLabel":"Productivity","description":"","iconAssetId":"synthetic-service","transport":"http","authMode":"oauth","availability":"unverified","blockerCodes":[]});
        for available in [None, Some(false), Some(true)] {
            let mut value = original.clone();
            if let Some(available) = available {
                value["authorizationAvailable"] = json!(available);
            }
            let entry: CatalogEntry = serde_json::from_value(value).unwrap();
            assert_eq!(
                entry.authorization_available.unwrap_or(false),
                available.unwrap_or(false)
            );
            assert_eq!(entry.availability, Availability::Unverified);
            let roundtrip = serde_json::to_value(entry).unwrap();
            assert_eq!(
                roundtrip.get("authorizationAvailable").is_some(),
                available.is_some()
            );
        }
        let mut null = original;
        null["authorizationAvailable"] = Value::Null;
        assert!(serde_json::from_value::<CatalogEntry>(null).is_err());
    }
}
