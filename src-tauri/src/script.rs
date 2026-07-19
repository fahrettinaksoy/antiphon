// Script sandbox — rquickjs (gömülü QuickJS).
//
// Kullanıcı pre-request/test script'leri TAM İZOLE bir QuickJS bağlamında koşar — host,
// dosya sistemi, ağ veya Tauri erişimi YOKTUR. Yalnızca `pm.*` API'si ve `console.log`
// köprülenir. Assertion/pm mantığı bir JS prelude olarak tanımlanır. Yürütme 2 sn ile sınırlıdır.

use rquickjs::{Context, Runtime};
use serde_json::{json, Value};
use std::time::{Duration, Instant};

const EXECUTION_TIMEOUT: Duration = Duration::from_millis(2000);

// pm/console/expect tanımları (node:vm script-engine'in birebir JS karşılığı).
const PRELUDE: &str = r#"
var console = { log: function () { __logs.push(Array.prototype.slice.call(arguments).map(String).join(' ')); } };
function __envApi(vars) {
  return {
    get: function (k) { return vars[k]; },
    set: function (k, v) { vars[k] = String(v); },
    unset: function (k) { delete vars[k]; }
  };
}
function __buildExpect(actual) {
  function fail(m) { throw new Error(m); }
  return { to: {
    equal: function (expected) { if (actual !== expected) fail('expected ' + JSON.stringify(actual) + ' to equal ' + JSON.stringify(expected)); },
    eql: function (expected) { if (JSON.stringify(actual) !== JSON.stringify(expected)) fail('expected ' + JSON.stringify(actual) + ' to deep-equal ' + JSON.stringify(expected)); },
    include: function (expected) { var ok = (typeof actual === 'string' || Array.isArray(actual)) ? actual.includes(expected) : false; if (!ok) fail('expected ' + JSON.stringify(actual) + ' to include ' + JSON.stringify(expected)); },
    be: {
      above: function (n) { if (!(actual > n)) fail('expected ' + actual + ' to be above ' + n); },
      below: function (n) { if (!(actual < n)) fail('expected ' + actual + ' to be below ' + n); },
      ok: function () { if (!actual) fail('expected value to be truthy'); },
      a: function (t) { if (typeof actual !== t) fail('expected ' + actual + ' to be a ' + t); }
    },
    not: { equal: function (expected) { if (actual === expected) fail('expected ' + JSON.stringify(actual) + ' not to equal ' + JSON.stringify(expected)); } }
  }};
}
var __tests = [];
var pm = { environment: __envApi(__vars), variables: __envApi(__vars) };
if (typeof __request !== 'undefined') pm.request = __request;
if (typeof __response !== 'undefined') {
  var __pj; var __pjf = false;
  pm.response = {
    code: __response.status, status: __response.status, headers: __response.headers,
    text: function () { return __response.body; },
    json: function () {
      if (__pj === undefined && !__pjf) {
        try { __pj = JSON.parse(__response.body); } catch (e) { __pjf = true; throw new Error('Response body geçerli JSON değil'); }
      }
      return __pj;
    }
  };
  pm.test = function (name, fn) {
    try { fn(); __tests.push({ name: name, passed: true }); }
    catch (e) { __tests.push({ name: name, passed: false, error: (e && e.message) ? e.message : String(e) }); }
  };
  pm.expect = function (a) { return __buildExpect(a); };
}
"#;

// QuickJS'te tam script'i (setup + prelude + kullanıcı + JSON çıktısı) koşar ve çıktı
// JSON'unu döndürür. Kullanıcı script'i try/catch ile sarılır (hata __logs'a düşer;
// ayrıştırma hatası veya timeout eval'i Err yapar → çağıran yedek sonucu döndürür).
fn run(setup: &str, user_script: &str, tail: &str) -> Result<Value, String> {
    let runtime = Runtime::new().map_err(|e| e.to_string())?;
    let start = Instant::now();
    runtime.set_interrupt_handler(Some(Box::new(move || start.elapsed() > EXECUTION_TIMEOUT)));
    let context = Context::full(&runtime).map_err(|e| e.to_string())?;

    let full = format!(
        "{setup}\n{PRELUDE}\ntry {{\n{user_script}\n}} catch (__e) {{ __logs.push('Script hatası: ' + ((__e && __e.message) ? __e.message : String(__e))); }}\n{tail}"
    );

    let output: String = context
        .with(|ctx| ctx.eval::<String, _>(full.as_bytes()))
        .map_err(|e| e.to_string())?;
    serde_json::from_str(&output).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn script_pre_request(script: String, variables: Value, request: Value) -> Value {
    if script.trim().is_empty() {
        return json!({ "variables": variables, "request": request, "consoleLogs": [] });
    }
    let setup = format!(
        "var __vars = {}; var __request = {}; var __logs = [];",
        variables, request
    );
    let tail = "JSON.stringify({ variables: __vars, request: __request, consoleLogs: __logs })";
    match run(&setup, &script, tail) {
        Ok(value) => value,
        // Ayrıştırma hatası/timeout: girdi değişmeden döner, hata log'a yazılır (node:vm paritesi).
        Err(message) => json!({
            "variables": variables,
            "request": request,
            "consoleLogs": [format!("Script hatası: {message}")]
        }),
    }
}

#[tauri::command]
pub fn script_test(script: String, variables: Value, response: Value) -> Value {
    if script.trim().is_empty() {
        return json!({ "tests": [], "variables": variables, "consoleLogs": [] });
    }
    let setup = format!(
        "var __vars = {}; var __response = {}; var __logs = [];",
        variables, response
    );
    let tail = "JSON.stringify({ tests: __tests, variables: __vars, consoleLogs: __logs })";
    match run(&setup, &script, tail) {
        Ok(value) => value,
        Err(message) => json!({
            "tests": [],
            "variables": variables,
            "consoleLogs": [format!("Script hatası: {message}")]
        }),
    }
}
