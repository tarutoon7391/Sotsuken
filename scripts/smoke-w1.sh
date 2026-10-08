#!/usr/bin/env bash
# W1（認証・クラス・授業・資料 API）の動作確認スクリプト
# 使い方：サーバーを起動してから  bash scripts/smoke-w1.sh [ベースURL]
#   例）bash scripts/smoke-w1.sh http://localhost:3001
# テストデータは w1_ 接頭辞＋実行ごとの乱数で作る（共有 DB なので他の人のデータと衝突させない）
set -u

BASE="${1:-http://localhost:${PORT:-3001}}"
API="$BASE/api"
RUN="$(date +%s)$RANDOM"
WORK="$(mktemp -d)"
# Windows（Git Bash）の curl は MSYS のパス（/tmp/...）を開けないので C:/... 形式にする
command -v cygpath >/dev/null 2>&1 && WORK="$(cygpath -m "$WORK")"
T_JAR="$WORK/teacher.txt"
S_JAR="$WORK/student.txt"
O_JAR="$WORK/outsider.txt"
PASS=0
FAIL=0
trap 'rm -rf "$WORK"' EXIT

# check <期待ステータス> <説明> <curl の引数...>  → レスポンス本文は $BODY に入る
check() {
  local expect="$1" label="$2"
  shift 2
  local out
  out="$(curl -s -w '\n%{http_code}' "$@")"
  BODY="$(printf '%s' "$out" | sed '$d')"
  local status
  status="$(printf '%s' "$out" | tail -n1)"
  if [ "$status" = "$expect" ]; then
    PASS=$((PASS + 1))
    echo "OK   $status $label"
  else
    FAIL=$((FAIL + 1))
    echo "NG   $status（期待 $expect）$label"
    echo "     $BODY"
  fi
}

# JSON から数値／文字列の値を1つ取り出す（jq が無い環境向けの簡易版）
json_num() { printf '%s' "$BODY" | grep -o "\"$1\":[0-9]*" | head -n1 | cut -d: -f2; }
json_str() { printf '%s' "$BODY" | grep -o "\"$1\":\"[^\"]*\"" | head -n1 | cut -d'"' -f4; }

JSON=(-H 'Content-Type: application/json')

# JSON 本文をファイルに書き、curl に渡す引数（@ファイル）を返す。
# Windows ではコマンドライン引数の日本語が CP932 に変わって文字化けするため、本文は必ずファイル経由で送る
jbody() {
  printf '%s' "$1" > "$WORK/body.json"
  printf '@%s' "$WORK/body.json"
}

echo "== 対象: $API（run=$RUN）"

check 200 "health" "$API/health"
check 401 "未ログインで /classes は 401" "$API/classes"

echo "== アカウント"
check 201 "先生 register" -c "$T_JAR" "${JSON[@]}" -X POST "$API/register" \
  --data-binary "$(jbody "{\"name\":\"W1先生\",\"login_id\":\"w1_teacher_$RUN\",\"password\":\"password123\",\"role\":\"teacher\"}")"
check 409 "同じログインIDで register は 409" "${JSON[@]}" -X POST "$API/register" \
  --data-binary "$(jbody "{\"name\":\"W1先生\",\"login_id\":\"w1_teacher_$RUN\",\"password\":\"password123\",\"role\":\"teacher\"}")"
check 400 "ロール不正は 400" "${JSON[@]}" -X POST "$API/register" \
  --data-binary "$(jbody "{\"name\":\"x\",\"login_id\":\"w1_bad_$RUN\",\"password\":\"password123\",\"role\":\"admin\"}")"
check 401 "パスワード違いの login は 401" "${JSON[@]}" -X POST "$API/login" \
  --data-binary "$(jbody "{\"login_id\":\"w1_teacher_$RUN\",\"password\":\"wrong-password\"}")"
check 200 "先生 login" -c "$T_JAR" -b "$T_JAR" "${JSON[@]}" -X POST "$API/login" \
  --data-binary "$(jbody "{\"login_id\":\"w1_teacher_$RUN\",\"password\":\"password123\"}")"
check 200 "GET /me" -b "$T_JAR" "$API/me"
check 200 "PUT /me（表示名変更）" -b "$T_JAR" "${JSON[@]}" -X PUT "$API/me" --data-binary "$(jbody '{"name":"W1先生（改）"}')"

check 201 "生徒 register" -c "$S_JAR" "${JSON[@]}" -X POST "$API/register" \
  --data-binary "$(jbody "{\"name\":\"W1生徒\",\"login_id\":\"w1_student_$RUN\",\"password\":\"password123\",\"role\":\"student\"}")"
check 201 "クラス外の生徒 register" -c "$O_JAR" "${JSON[@]}" -X POST "$API/register" \
  --data-binary "$(jbody "{\"name\":\"W1部外者\",\"login_id\":\"w1_outsider_$RUN\",\"password\":\"password123\",\"role\":\"student\"}")"

echo "== クラス"
check 403 "生徒はクラスを作れない" -b "$S_JAR" "${JSON[@]}" -X POST "$API/classes" --data-binary "$(jbody '{"name":"x"}')"
check 201 "先生 クラス作成" -b "$T_JAR" "${JSON[@]}" -X POST "$API/classes" --data-binary "$(jbody '{"name":"W1テストクラス"}')"
CLASS_ID="$(json_num id)"
JOIN_CODE="$(json_str join_code)"
echo "     class_id=$CLASS_ID join_code=$JOIN_CODE"
check 404 "存在しない参加コードは 404" -b "$S_JAR" "${JSON[@]}" -X POST "$API/classes/join" --data-binary "$(jbody '{"join_code":"ZZZZZZZZ"}')"
# 画面の表示どおり XXXX-XXXX（小文字）で入力しても加入できる（v4.3 裁定）
HYPHEN_CODE="$(printf '%s' "${JOIN_CODE:0:4}-${JOIN_CODE:4:4}" | tr 'A-Z' 'a-z')"
check 200 "生徒 join（ハイフン付き・小文字）" -b "$S_JAR" "${JSON[@]}" -X POST "$API/classes/join" --data-binary "$(jbody "{\"join_code\":\"$HYPHEN_CODE\"}")"
check 200 "生徒 join（加入済みでも成功）" -b "$S_JAR" "${JSON[@]}" -X POST "$API/classes/join" --data-binary "$(jbody "{\"join_code\":\"$JOIN_CODE\"}")"
check 200 "生徒 クラス一覧" -b "$S_JAR" "$API/classes"
check 200 "先生 クラス詳細（join_code あり）" -b "$T_JAR" "$API/classes/$CLASS_ID"
[ -n "$(json_str join_code)" ] && echo "     join_code 含む: OK" || { echo "     NG join_code が無い"; FAIL=$((FAIL + 1)); }
check 200 "生徒 クラス詳細（join_code なし）" -b "$S_JAR" "$API/classes/$CLASS_ID"
[ -z "$(json_str join_code)" ] && echo "     join_code 含まない: OK" || { echo "     NG 生徒に join_code が見えている"; FAIL=$((FAIL + 1)); }
check 403 "クラス外はクラス詳細 403" -b "$O_JAR" "$API/classes/$CLASS_ID"
check 200 "先生 メンバー一覧" -b "$T_JAR" "$API/classes/$CLASS_ID/members"
check 403 "生徒はメンバー一覧 403" -b "$S_JAR" "$API/classes/$CLASS_ID/members"

echo "== 授業"
check 201 "授業作成（タグ付き）" -b "$T_JAR" "${JSON[@]}" -X POST "$API/classes/$CLASS_ID/lessons" \
  --data-binary "$(jbody '{"title":"第1回 W1テスト","tags":["数学","一次関数"]}')"
LESSON_ID="$(json_num id)"
check 201 "授業作成（2つ目）" -b "$T_JAR" "${JSON[@]}" -X POST "$API/classes/$CLASS_ID/lessons" \
  --data-binary "$(jbody '{"title":"第2回 W1テスト","tags":["数学"]}')"
LESSON2_ID="$(json_num id)"
check 200 "授業一覧" -b "$S_JAR" "$API/classes/$CLASS_ID/lessons"
check 200 "授業一覧 ?tag=一次関数" -b "$S_JAR" "$API/classes/$CLASS_ID/lessons?tag=%E4%B8%80%E6%AC%A1%E9%96%A2%E6%95%B0"
echo "     $BODY"
check 200 "タグ一覧" -b "$S_JAR" "$API/classes/$CLASS_ID/tags"
check 200 "授業詳細" -b "$S_JAR" "$API/lessons/$LESSON_ID"
check 403 "クラス外は授業詳細 403" -b "$O_JAR" "$API/lessons/$LESSON_ID"
check 200 "PATCH 授業（閾値・タイトル・タグ）" -b "$T_JAR" "${JSON[@]}" -X PATCH "$API/lessons/$LESSON_ID" \
  --data-binary "$(jbody '{"away_timeout_min":10,"title":"第1回 W1テスト（改）","tags":["数学"]}')"
check 400 "PATCH 閾値不正は 400" -b "$T_JAR" "${JSON[@]}" -X PATCH "$API/lessons/$LESSON_ID" --data-binary "$(jbody '{"away_timeout_min":0}')"
check 403 "生徒は授業開始できない" -b "$S_JAR" -X POST "$API/lessons/$LESSON_ID/start"
check 200 "授業開始" -b "$T_JAR" -X POST "$API/lessons/$LESSON_ID/start"
check 409 "同じクラスで2つ目を開始すると 409 ALREADY_LIVE" -b "$T_JAR" -X POST "$API/lessons/$LESSON2_ID/start"
echo "     code=$(json_str code)"
check 200 "クラス詳細の live_lesson_id" -b "$S_JAR" "$API/classes/$CLASS_ID"
echo "     live_lesson_id=$(json_num live_lesson_id)（期待 $LESSON_ID）"

echo "== 資料・添付"
SAMPLE_PDF="$WORK/sample.pdf"
printf '%%PDF-1.4\n%% w1 smoke\n' > "$SAMPLE_PDF"
SAMPLE_TXT="$WORK/sample.txt"
echo "text" > "$SAMPLE_TXT"
check 403 "生徒は資料（material）を上げられない" -b "$S_JAR" -X POST "$API/lessons/$LESSON_ID/files" \
  -F kind=material -F "file=@$SAMPLE_PDF;type=application/pdf"
check 400 "許可外の MIME は 400" -b "$T_JAR" -X POST "$API/lessons/$LESSON_ID/files" \
  -F kind=material -F "file=@$SAMPLE_TXT;type=text/plain"
check 201 "先生 資料アップロード" -b "$T_JAR" -X POST "$API/lessons/$LESSON_ID/files" \
  -F kind=material -F "file=@$SAMPLE_PDF;type=application/pdf"
FILE_ID="$(json_num file_id)"
FILE_URL="$(json_str url)"
[ -n "$FILE_URL" ] || FILE_URL="/uploads/__missing__"
check 200 "アップロードしたファイルが配信される" "$BASE$FILE_URL"
check 201 "生徒 添付アップロード" -b "$S_JAR" -X POST "$API/lessons/$LESSON_ID/files" \
  -F kind=attachment -F "file=@$SAMPLE_PDF;type=application/pdf"
check 200 "資料一覧 ?kind=material" -b "$S_JAR" "$API/lessons/$LESSON_ID/files?kind=material"
echo "     $BODY"
check 403 "クラス外は資料一覧 403" -b "$O_JAR" "$API/lessons/$LESSON_ID/files?kind=material"
check 403 "アップロード者以外は削除 403" -b "$S_JAR" -X DELETE "$API/files/$FILE_ID"
check 204 "アップロード者が削除" -b "$T_JAR" -X DELETE "$API/files/$FILE_ID"
check 404 "削除後はファイル本体も消えている" "$BASE$FILE_URL"

echo "== 授業終了・ログアウト"
check 200 "授業終了" -b "$T_JAR" -X POST "$API/lessons/$LESSON_ID/end"
check 409 "終了済みを再度終了すると 409" -b "$T_JAR" -X POST "$API/lessons/$LESSON_ID/end"
check 200 "終了済み授業の資料一覧も取得できる" -b "$S_JAR" "$API/lessons/$LESSON_ID/files?kind=material"
check 204 "logout" -b "$T_JAR" -c "$T_JAR" -X POST "$API/logout"
check 401 "logout 後の /me は 401" -b "$T_JAR" "$API/me"

echo
echo "== 結果: OK $PASS / NG $FAIL"
[ "$FAIL" -eq 0 ]
