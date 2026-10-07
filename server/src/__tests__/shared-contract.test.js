// jest から @sotsuken/shared（CommonJS 版）が読めることの確認（契約の形が崩れていないかの最小チェック）
const { ROLES, ERROR_CODES, DEFAULTS, roomNames } = require('@sotsuken/shared/constants');
const { CLIENT_EVENTS, SERVER_EVENTS } = require('@sotsuken/shared/socket-events');

test('shared/constants が require できる', () => {
  expect(ROLES.TEACHER).toBe('teacher');
  expect(ERROR_CODES.ALREADY_ABSENT).toBe('ALREADY_ABSENT');
  expect(DEFAULTS.AWAY_TIMEOUT_MIN).toBe(15);
  expect(roomNames.teachers(3)).toBe('lesson:3:teacher');
});

test('shared/socket-events が require できる', () => {
  expect(CLIENT_EVENTS.UNDERSTANDING_SEND).toBe('understanding:send');
  expect(SERVER_EVENTS.LESSON_ENDED).toBe('lesson:ended');
});
