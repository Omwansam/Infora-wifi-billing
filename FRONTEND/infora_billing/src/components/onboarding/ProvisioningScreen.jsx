import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, Check, Circle, Loader2, X } from 'lucide-react';
import { fetchStatus } from '../../services/onboardingService';

const POLL_MS = 1200;

function TaskMark({ status }) {
  if (status === 'done') {
    return (
      <span className="onb__task-mark onb__task-mark--done">
        <Check size={13} strokeWidth={3} />
      </span>
    );
  }
  if (status === 'running') {
    return (
      <span className="onb__task-mark onb__task-mark--running">
        <Loader2 size={13} className="onb__spin" />
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="onb__task-mark onb__task-mark--failed">
        <X size={13} strokeWidth={3} />
      </span>
    );
  }
  return (
    <span className="onb__task-mark">
      <Circle size={7} fill="currentColor" />
    </span>
  );
}

/**
 * The provisioning screen — polls `/status` until the tenant is ready.
 *
 * Elapsed time comes from the server, which measured it from when the job
 * actually started. A client-side stopwatch would restart on a page refresh and
 * report a number that is simply wrong.
 */
export default function ProvisioningScreen({
  token,
  slug,
  accountAddress,
  initialTasks,
  onFinish,
}) {
  const navigate = useNavigate();
  const [state, setState] = useState({
    status: 'provisioning',
    tasks: initialTasks || [],
    elapsed: 0,
    address: accountAddress,
    error: null,
  });
  const [pollError, setPollError] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      const result = await fetchStatus(token);
      if (cancelled) return;

      if (!result.ok) {
        // A dropped poll is not a failed signup — the job is running on the
        // server regardless. Surface it and keep trying.
        setPollError(result.error);
        timer.current = setTimeout(poll, POLL_MS * 2);
        return;
      }

      setPollError(null);
      const data = result.data;
      setState({
        status: data.status,
        tasks: data.tasks || [],
        elapsed: data.elapsed_seconds ?? 0,
        address: data.account_address || accountAddress,
        error: data.error,
      });

      if (data.status === 'provisioning') {
        timer.current = setTimeout(poll, POLL_MS);
      }
    };

    poll();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const done = state.status === 'completed';
  const failed = state.status === 'failed';

  return (
    <>
      <h1 className="onb__prov-title">
        {done ? 'Account ready' : failed ? 'Setup could not finish' : 'Setting up your account'}
      </h1>
      <p className="onb__prov-sub">
        {done && 'Your operator console is ready — sign in to continue.'}
        {failed && 'We hit a problem finishing your account. Contact support and quote your account address below.'}
        {!done && !failed && 'Provisioning your workspace. This usually takes under a minute.'}
      </p>

      {failed && state.error && (
        <div className="onb__banner" role="alert">
          <AlertCircle size={16} />
          <span>{state.error}</span>
        </div>
      )}

      {pollError && !done && !failed && (
        <div className="onb__banner onb__banner--info">
          <AlertCircle size={16} />
          <span>
            Lost contact with the server — still setting up in the background.
            Retrying…
          </span>
        </div>
      )}

      <div aria-live="polite">
        {state.tasks.map((task) => (
          <div key={task.key} className={`onb__task onb__task--${task.status}`}>
            <TaskMark status={task.status} />
            <span className="onb__task-body">
              <span className="onb__task-label">{task.label}</span>
              {task.detail && <span className="onb__task-detail">{task.detail}</span>}
            </span>
            {task.status !== 'pending' && (
              <span
                className={
                  'onb__task-state'
                  + (task.status === 'failed' ? ' onb__task-state--failed' : '')
                }
              >
                {task.status.toUpperCase()}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="onb__meta">
        <span>tenant <code>{slug}</code></span>
        <span>elapsed {state.elapsed}s</span>
        {state.address && <span>{state.address}</span>}
      </div>

      {done && (
        <button
          type="button"
          className="onb__submit"
          style={{ marginTop: 22 }}
          onClick={() => {
            // Retire the signup here rather than the moment it completes: a
            // refresh during the last second of provisioning must still land
            // on this screen. Once they leave, /signup is free for a new one.
            onFinish?.();
            navigate('/login', { replace: true });
          }}
        >
          Go to sign in
          <ArrowRight size={17} />
        </button>
      )}
    </>
  );
}
