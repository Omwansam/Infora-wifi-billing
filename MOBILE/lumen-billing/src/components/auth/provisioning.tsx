/**
 * The provisioning screen — what runs after `POST /complete` returns 202.
 *
 * The job is a background thread on the server and takes a few seconds, so the
 * honest thing is to show the four tasks it actually performs rather than a
 * spinner over a lie.
 *
 * There is no "try again" on failure, deliberately. `/complete` moves the
 * signup row to `provisioning`, and `_signup_from_token` then refuses that
 * token for anything but a status poll — so a retry button would return 409
 * every time. A half-provisioned tenant needs support with the account address
 * in hand, which is what this says instead.
 */
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Text, View } from 'react-native';
import { mono, type AuthPalette } from '@/lib/auth-theme';
import type { ProvisioningTask } from '@/services/onboarding';
import { AuthNotice, AuthSubmit, AuthSubtitle, AuthTitle } from './ui';

function TaskRow({ palette, task }: { palette: AuthPalette; task: ProvisioningTask }) {
  const done = task.status === 'done';
  const running = task.status === 'running';
  const failed = task.status === 'failed';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 }}>
      <View
        style={{
          height: 26,
          width: 26,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: done
            ? palette.accentSoft
            : failed
              ? `${palette.err}22`
              : palette.lineSoft,
        }}>
        {running ? (
          <ActivityIndicator size="small" color={palette.accent} />
        ) : (
          <Ionicons
            name={done ? 'checkmark' : failed ? 'close' : 'ellipse-outline'}
            size={done || failed ? 15 : 11}
            color={done ? palette.accent : failed ? palette.err : palette.textFaint}
          />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: done || running ? palette.text : palette.textFaint,
            fontSize: 14.5,
            fontWeight: running ? '600' : '500',
          }}>
          {task.label}
        </Text>
        {task.detail ? (
          <Text style={{ color: palette.textFaint, fontSize: 12, marginTop: 2 }}>
            {task.detail}
          </Text>
        ) : null}
      </View>
      {task.status !== 'pending' ? (
        <Text
          style={{
            ...mono,
            fontSize: 9.5,
            letterSpacing: 0.8,
            fontWeight: '700',
            color: failed ? palette.err : done ? palette.ok : palette.textFaint,
          }}>
          {String(task.status).toUpperCase()}
        </Text>
      ) : null}
    </View>
  );
}

export function ProvisioningView({
  palette,
  tasks,
  status,
  slug,
  accountAddress,
  elapsedSeconds,
  error,
  lostContact,
  onSignIn,
}: {
  palette: AuthPalette;
  tasks: ProvisioningTask[];
  status: string;
  slug?: string | null;
  accountAddress?: string | null;
  elapsedSeconds?: number | null;
  error?: string | null;
  /** The poll could not reach the server. The job keeps running regardless. */
  lostContact?: boolean;
  onSignIn: () => void;
}) {
  const done = status === 'completed';
  const failed = status === 'failed';

  return (
    <View>
      <View style={{ alignItems: 'center', marginBottom: 4 }}>
        <View
          style={{
            height: 56,
            width: 56,
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: failed ? `${palette.err}22` : palette.accentSoft,
            marginBottom: 16,
          }}>
          {done || failed ? (
            <Ionicons
              name={failed ? 'alert' : 'checkmark'}
              size={26}
              color={failed ? palette.err : palette.accent}
            />
          ) : (
            <ActivityIndicator size="small" color={palette.accent} />
          )}
        </View>
      </View>

      <AuthTitle palette={palette}>
        {done ? 'Account ready' : failed ? 'Setup could not finish' : 'Setting up your account'}
      </AuthTitle>
      <AuthSubtitle palette={palette}>
        {done
          ? 'Your operator console is ready — sign in to continue.'
          : failed
            ? 'We hit a problem finishing your account. Contact support and quote the account address below.'
            : 'Provisioning your workspace. This usually takes under a minute.'}
      </AuthSubtitle>

      {failed && error ? (
        <View style={{ marginTop: 16 }}>
          <AuthNotice palette={palette} tone="error">
            {error}
          </AuthNotice>
        </View>
      ) : null}

      {lostContact && !done && !failed ? (
        <View style={{ marginTop: 16 }}>
          <AuthNotice palette={palette} tone="info">
            Lost contact with the server — still setting up in the background. Retrying…
          </AuthNotice>
        </View>
      ) : null}

      <View style={{ marginTop: 14 }}>
        {tasks.map((task) => (
          <TaskRow key={task.key} palette={palette} task={task} />
        ))}
      </View>

      <View
        style={{
          marginTop: 12,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: palette.lineSoft,
          gap: 4,
        }}>
        {slug ? (
          <Text style={{ ...mono, color: palette.textFaint, fontSize: 11 }}>tenant {slug}</Text>
        ) : null}
        {accountAddress ? (
          <Text style={{ ...mono, color: palette.accentHi, fontSize: 11 }}>{accountAddress}</Text>
        ) : null}
        {typeof elapsedSeconds === 'number' ? (
          <Text style={{ ...mono, color: palette.textFaint, fontSize: 11 }}>
            elapsed {elapsedSeconds}s
          </Text>
        ) : null}
      </View>

      {done ? (
        <View style={{ marginTop: 20 }}>
          <AuthSubmit
            palette={palette}
            label="Go to sign in"
            icon="log-in-outline"
            onPress={onSignIn}
          />
        </View>
      ) : failed ? (
        <View style={{ marginTop: 20 }}>
          <AuthSubmit
            palette={palette}
            label="Back to sign in"
            icon="arrow-back"
            onPress={onSignIn}
          />
        </View>
      ) : null}
    </View>
  );
}
