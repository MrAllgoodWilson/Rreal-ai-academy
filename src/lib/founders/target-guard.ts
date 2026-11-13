export interface TargetGuardQueryable {
  query(sql: string, params?: any[]): Promise<{ rows: any[] }>;
}

export interface TargetGuardOptions {
  testDbUrl?: string;
  runNonce?: string;
  expectedServerIp?: string;
  maxUptimeSeconds?: number;
}

export interface TargetGuardVerificationResult {
  serverIp: string;
  uptimeSeconds: number;
  role: string;
  nonce: string;
}

/**
 * Enforces strict fail-closed target database identity verification.
 * Rejects any non-loopback address unless exact TEST_EXPECT_SERVER_IP is supplied.
 * Rejects superuser or createdb privileged roles.
 * Rejects servers with uptime > maxUptimeSeconds (default 3600s).
 * Verifies out-of-band ephemeral run nonce in qa_run_marker table.
 */
export async function verifyTargetGuard(
  client: TargetGuardQueryable,
  options?: TargetGuardOptions,
): Promise<TargetGuardVerificationResult> {
  const runNonce = options?.runNonce ?? process.env.TEST_RUN_NONCE;
  const expectedIp = options?.expectedServerIp ?? process.env.TEST_EXPECT_SERVER_IP;
  const maxUptime = options?.maxUptimeSeconds ?? 3600;

  if (!runNonce) {
    throw new Error(
      'Target identity guard: TEST_RUN_NONCE is required to verify disposable harness marker. Tests fail closed.',
    );
  }

  // 1. Verify loopback connection (inet_server_addr() must be 127.0.0.1 or ::1) OR exact expected IP
  const ipCheck = await client.query('SELECT inet_server_addr() AS srv_ip;');
  const srvIp = ipCheck.rows[0]?.srv_ip;
  const isLoopback = !srvIp || srvIp === '127.0.0.1' || srvIp === '::1';
  const isExplicitExpectedIp = Boolean(expectedIp && srvIp === expectedIp);

  if (!isLoopback && !isExplicitExpectedIp) {
    throw new Error(
      `Target identity guard: inet_server_addr() is "${srvIp}", expected loopback (127.0.0.1 / ::1) or exact TEST_EXPECT_SERVER_IP match. Rejected.`,
    );
  }

  // 2. Verify recent server start time (< maxUptime)
  const timeCheck = await client.query(
    'SELECT EXTRACT(EPOCH FROM (NOW() - pg_postmaster_start_time())) AS uptime_seconds;',
  );
  const uptimeSec = parseFloat(timeCheck.rows[0]?.uptime_seconds ?? '999999');
  if (isNaN(uptimeSec) || uptimeSec > maxUptime) {
    throw new Error(
      `Target identity guard: Server uptime (${uptimeSec.toFixed(0)}s) exceeds ${maxUptime}s. Target must be a freshly launched ephemeral container.`,
    );
  }

  // 3. Verify restricted role privileges (not superuser, cannot create DB)
  const roleCheck = await client.query(
    'SELECT CURRENT_USER AS current_user, rolsuper, rolcreatedb FROM pg_roles WHERE rolname = CURRENT_USER;',
  );
  if (roleCheck.rows.length === 0) {
    throw new Error('Target identity guard: Current role not found in pg_roles.');
  }
  const roleRow = roleCheck.rows[0];
  if (roleRow.rolsuper || roleRow.rolcreatedb) {
    throw new Error(
      `Target identity guard: Target role "${roleRow.current_user}" must be a non-superuser, non-createdb restricted test role (rolsuper=${roleRow.rolsuper}, rolcreatedb=${roleRow.rolcreatedb}).`,
    );
  }

  // 4. Verify out-of-band harness run nonce in qa_run_marker table
  const nonceCheck = await client.query('SELECT nonce FROM qa_run_marker WHERE nonce = $1;', [runNonce]);
  if (nonceCheck.rows.length === 0) {
    throw new Error(`Target identity guard: Nonce "${runNonce}" not verified in qa_run_marker.`);
  }

  return {
    serverIp: srvIp || '127.0.0.1',
    uptimeSeconds: uptimeSec,
    role: roleRow.current_user || 'test_user',
    nonce: runNonce,
  };
}
