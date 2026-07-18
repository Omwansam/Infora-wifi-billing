import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Badge, ErrorState, Loading } from '@/components/ui';
import { PageHeader } from '@/components/ui/page-header';
import { useTicket } from '@/hooks/use-data';
import type { TicketMessage } from '@/data/types';
import { formatDateTime } from '@/lib/format';
import { useAppTheme } from '@/lib/theme';

function Bubble({ msg }: { msg: TicketMessage }) {
  const isStaff = msg.senderType === 'staff';
  return (
    <View className={`mb-4 max-w-[82%] ${isStaff ? 'self-end' : 'self-start'}`}>
      {!isStaff ? (
        <Text className="mb-1 ml-1 text-xs font-semibold text-ink-muted dark:text-ink-faint">
          {msg.sender}
        </Text>
      ) : null}
      <View
        className={`rounded-2xl px-4 py-3 ${
          isStaff
            ? 'rounded-br-md bg-brand-600'
            : 'rounded-bl-md bg-surface dark:bg-night-card'
        }`}>
        <Text className={`text-[15px] ${isStaff ? 'text-white' : 'text-ink dark:text-white'}`}>
          {msg.message}
        </Text>
      </View>
      <Text className={`mt-1 text-[11px] text-ink-faint ${isStaff ? 'text-right' : 'ml-1'}`}>
        {formatDateTime(msg.createdAt)}
      </Text>
    </View>
  );
}

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const { data: ticket, loading, error, refetch } = useTicket(Number(id));
  const [draft, setDraft] = useState('');

  if (!ticket) {
    return (
      <View className="flex-1 bg-surface-muted dark:bg-night">
        <PageHeader title="Ticket" />
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="text-ink-muted dark:text-ink-faint">Ticket not found.</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface-muted dark:bg-night">
      <PageHeader title={`Ticket #${ticket.id}`} subtitle={ticket.customerName} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 44}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: 16 }}>
          {/* Ticket meta */}
          <View className="mb-5 rounded-2xl border border-line bg-surface p-4 dark:border-night-line dark:bg-night-card">
            <Text className="text-base font-bold text-ink dark:text-white">{ticket.subject}</Text>
            <View className="mt-3 flex-row items-center gap-2">
              <Badge label={ticket.status} status />
              <Badge label={ticket.priority} status />
            </View>
            <View className="mt-3 flex-row items-center">
              <Avatar name={ticket.assignedTo} size="sm" />
              <Text className="ml-2 text-xs text-ink-muted dark:text-ink-faint">
                Assigned to {ticket.assignedTo}
              </Text>
            </View>
          </View>

          {ticket.messages.map((m) => (
            <Bubble key={m.id} msg={m} />
          ))}
        </ScrollView>

        {/* Reply composer */}
        <View
          className="flex-row items-end border-t border-line bg-surface px-3 pt-3 dark:border-night-line dark:bg-night-card"
          style={{ paddingBottom: insets.bottom + 8 }}>
          <View className="mr-2 max-h-28 flex-1 rounded-2xl bg-surface-sunken px-4 py-2.5 dark:bg-night-raised">
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Write a reply…"
              placeholderTextColor={theme.textFaint}
              multiline
              className="text-[15px] text-ink dark:text-white"
            />
          </View>
          <Pressable
            onPress={() => setDraft('')}
            className={`h-11 w-11 items-center justify-center rounded-full ${
              draft.trim() ? 'bg-brand-600' : 'bg-surface-sunken dark:bg-night-raised'
            }`}>
            <Ionicons name="send" size={18} color={draft.trim() ? '#ffffff' : theme.textFaint} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
