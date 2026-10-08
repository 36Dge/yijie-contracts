package marketprovider

import (
	"encoding/json"
	"fmt"
	"testing"
)

func TestDailyArgumentsUseOneInstrumentAndGregorianDay(t *testing.T) {
	for _, code := range []string{"000001.SZ", "600000.SH", "920001.BJ"} {
		for _, day := range []string{"00010101", "20000229", "20240229", "20260105", "99991231"} {
			value := TushareDailyArguments{TsCode: code, TradeDate: day}
			if err := value.Validate(); err != nil {
				t.Fatal(code, day, err)
			}
			encoded, err := json.Marshal(value)
			if err != nil {
				t.Fatal(err)
			}
			var fields map[string]any
			if err := json.Unmarshal(encoded, &fields); err != nil {
				t.Fatal(err)
			}
			if len(fields) != 2 || fields["ts_code"] != code || fields["trade_date"] != day {
				t.Fatal("normalized upstream field names changed")
			}
		}
	}
	for _, day := range []string{"00000101", "19000229", "21000229", "20250229", "20260230", "20260431", "20260001", "20260100", "20261301"} {
		if err := (TushareDailyArguments{TsCode: "000001.SZ", TradeDate: day}).Validate(); err == nil {
			t.Fatal("invalid day accepted", day)
		}
	}
	for year := 2000; year < 2400; year++ {
		value := TushareDailyArguments{TsCode: "600000.SH", TradeDate: fmt.Sprintf("%04d0229", year)}
		leap := year%4 == 0 && (year%100 != 0 || year%400 == 0)
		if (value.Validate() == nil) != leap {
			t.Fatal("calendar mismatch", year)
		}
	}
	for _, raw := range []string{`{"ts_code":"000001.SZ"}`, `{"ts_code":"000001.SZ","trade_date":"20260105","fields":"close"}`, `{"ts_code":"000001.SZ,600000.SH","trade_date":"20260105"}`} {
		var args TushareDailyArguments
		if err := json.Unmarshal([]byte(raw), &args); err == nil {
			t.Fatal("non-normalized arguments accepted")
		}
	}
}

func TestDailyPolicyConstantsRetainReadOnlySingleCallBoundary(t *testing.T) {
	if TushareDailyProfile != "tushare-daily-v1" || TushareDailyToolName != "tushare_daily" || TushareDailyUpstreamToolName != "daily" || TushareDailyRisk != "read" || TushareDailyPermissionMode != "ask" || TushareDailyMaxRows != 1 || TushareDailyMaxCallsPerApproval != 1 {
		t.Fatal("daily profile changed")
	}
	var input map[string]any
	if err := json.Unmarshal([]byte(TushareDailyInputSchemaJson), &input); err != nil {
		t.Fatal(err)
	}
	if input["additionalProperties"] != false || len(input["properties"].(map[string]any)) != 2 {
		t.Fatal("daily schema is no longer closed")
	}
	var output map[string]any
	if err := json.Unmarshal([]byte(TushareDailyOutputSchemaJson), &output); err != nil {
		t.Fatal(err)
	}
	rows := output["properties"].(map[string]any)[TushareDailyResultRowsField].(map[string]any)
	row := rows["items"].(map[string]any)
	required := row["required"].([]any)
	if rows["maxItems"] != float64(1) || row["additionalProperties"] != false || len(required) != 3 || required[2] != "close" || TushareDailyResultRequiredNumericFields[0] != "close" {
		t.Fatal("nonempty daily result must require close")
	}
}
