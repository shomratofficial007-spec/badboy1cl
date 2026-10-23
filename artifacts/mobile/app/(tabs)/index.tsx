import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAssistant } from '@/context/AssistantContext';
import { streamReply } from '@/lib/assistant/api';
import {
  dictateOnce,
  isDictationAvailable,
  isReadAloudAvailable,
  speak,
  stopSpeaking,
} from '@/lib/assistant/voice';
import type { ChatMessage } from '@/lib/assistant/types';
import { useColors } from '@/hooks/useColors';

function newMessage(role: ChatMessage['role'], content = ''): ChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { messages, setMessages, settings, updateSettings } = useAssistant();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [improving, setImproving] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const stopDictationRef = useRef<(() => void) | null>(null);

  const sendMessage = useCallback(async (rawText: string) => {
    const text = rawText.trim();
    if (!text || busy) return;
    Keyboard.dismiss();
    setDraft('');
    setError(null);

    const userMessage = newMessage('user', text);
    let answer = newMessage('assistant');
    let working = [...messages, userMessage, answer];
    setMessages(working);
    setBusy(true);

    if (!settings.onlineAI) {
      working = working.filter((message) => message.id !== answer.id);
      setMessages(working);
      setError('অফলাইন মোড চালু আছে। আপনার বার্তা এই ফোনে থাকবে, AI-তে পাঠানো হবে না।');
      setBusy(false);
      return;
    }

    try {
      await streamReply(text, settings, (chunk) => {
        answer = { ...answer, content: answer.content + chunk };
        working = working.map((message) =>
          message.id === answer.id ? answer : message,
        );
        setMessages(working);
      });
    } catch (cause) {
      working = working.filter((message) => message.id !== answer.id);
      setMessages(working);
      setError(
        cause instanceof Error
          ? cause.message
          : 'AI উত্তর দিতে পারেনি। আবার চেষ্টা করুন।',
      );
    } finally {
      setBusy(false);
    }
  }, [busy, messages, setMessages, settings]);

  const requestImprovement = useCallback(async () => {
    const lastUserMessage = [...messages].reverse().find((item) => item.role === 'user');
    if (!lastUserMessage || !settings.onlineAI || !settings.autoImprove || improving) return;
    setImproving(true);
    setError(null);
    let suggestion = '';
    try {
      await streamReply(
        `Based only on this user's current message, suggest one concise optional change to my communication style. Do not apply it. Return only the suggestion. User message: ${lastUserMessage.content}`,
        settings,
        (chunk) => { suggestion += chunk; },
      );
      if (!suggestion.trim()) throw new Error('কোনো পরামর্শ পাওয়া যায়নি।');
      Alert.alert(
        'ব্যক্তিত্বের পরামর্শ',
        suggestion.trim(),
        [
          { text: 'এখন নয়', style: 'cancel' },
          {
            text: 'অনুমতি দিয়ে যোগ করুন',
            onPress: () => updateSettings({
              personality: `${settings.personality.trim()}\n${suggestion.trim()}`.trim(),
            }),
          },
        ],
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'পরামর্শ পাওয়া যায়নি।');
    } finally {
      setImproving(false);
    }
  }, [improving, messages, settings, updateSettings]);

  const toggleVoice = useCallback(() => {
    if (Platform.OS !== 'web' || !isDictationAvailable()) {
      setError(
        'এই ডিভাইসে ভয়েস টাইপিং সমর্থিত নয়। আপাতত লিখে চ্যাট করুন।',
      );
      return;
    }
    if (!settings.voiceProcessingConsent) {
      setError(
        'ভয়েস টাইপিং চালু করতে Settings-এ ভয়েস সম্মতি দিন। আপনার কণ্ঠ ব্রাউজারের speech service-এ পাঠানো হবে।',
      );
      return;
    }
    if (listening) {
      stopDictationRef.current?.();
      stopDictationRef.current = null;
      return;
    }
    setError(null);
    setListening(true);
    const base = draft;
    stopDictationRef.current = dictateOnce({
      onTranscript: (text) => {
        const combined = base ? `${base} ${text}`.trim() : text.trim();
        setDraft(combined.slice(0, 4000));
      },
      onError: () => setError('ভয়েস শোনা যায়নি। আবার চেষ্টা করুন।'),
      onDone: () => {
        setListening(false);
        stopDictationRef.current = null;
      },
    });
  }, [draft, listening, settings.voiceProcessingConsent]);

  const toggleReadAloud = useCallback(() => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    const lastAssistant = [...messages]
      .reverse()
      .find((item) => item.role === 'assistant' && item.content.trim());
    if (!lastAssistant) {
      setError('পড়ে শোনানোর মতো কোনো উত্তর নেই।');
      return;
    }
    if (Platform.OS !== 'web' || !isReadAloudAvailable()) {
      setError('এই ডিভাইসে পড়ে শোনানো সমর্থিত নয়।');
      return;
    }
    setError(null);
    setSpeaking(true);
    speak(lastAssistant.content);
    // SpeechSynthesis has no reliable cross-browser end event through
    // this path, so release the button shortly after starting.
    setTimeout(() => setSpeaking(false), 1500);
  }, [messages, speaking]);

  const clearChat = () => {
    Alert.alert(
      'চ্যাট মুছবেন?',
      'এই ফোনে রাখা চ্যাট ইতিহাস মুছে যাবে। এই কাজটি ফিরিয়ে আনা যাবে না।',
      [
        { text: 'বাতিল', style: 'cancel' },
        {
          text: 'চ্যাট মুছুন',
          style: 'destructive',
          onPress: () => setMessages([]),
        },
      ],
    );
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageRow, isUser && styles.userRow]}>
        <View
          style={[
            styles.messageBubble,
            { backgroundColor: isUser ? colors.primary : colors.card },
            isUser && styles.userBubble,
          ]}
        >
          <Text style={{ color: isUser ? colors.primaryForeground : colors.foreground, fontSize: 16, lineHeight: 24 }}>
            {item.content || (busy && item.role === 'assistant' ? 'ভাবছি…' : '')}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 4 : 0}
    >
      <View
        style={[
          styles.header,
          {
            paddingTop:
              (Platform.OS === 'web' ? 67 : Math.max(insets.top, 12)) + 8,
          },
        ]}
      >
        <View style={styles.brand}>
          <View style={[styles.logo, { backgroundColor: colors.primary }]}>
            <Feather name="sun" size={18} color={colors.primaryForeground} />
          </View>
          <View>
            <Text style={[styles.brandTitle, { color: colors.foreground }]}>Oi Assistant</Text>
            <Text style={[styles.brandSub, { color: colors.mutedForeground }]}>
              {settings.onlineAI ? 'অনলাইন · শুধু বর্তমান বার্তা পাঠানো হয়' : 'অফলাইন · শুধু এই ফোনে'}
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="চ্যাট ইতিহাস মুছুন"
          onPress={clearChat}
          style={[styles.iconButton, { backgroundColor: colors.card }]}
        >
          <Feather name="trash-2" size={18} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {!messages.length ? (
        <View style={styles.welcome}>
          <View style={[styles.welcomeMark, { backgroundColor: colors.accent }]}>
            <Feather name="message-circle" size={28} color={colors.accentForeground} />
          </View>
          <Text style={[styles.welcomeTitle, { color: colors.foreground }]}>কীভাবে সাহায্য করতে পারি?</Text>
          <Text style={[styles.welcomeText, { color: colors.mutedForeground }]}>
            লিখে চ্যাট করুন। আপনার সেভ করা মেমোরি AI-কে পাঠানো হয় না।
          </Text>
          <View style={styles.suggestions}>
            {['আজকের কাজ গুছিয়ে দাও', 'একটি নতুন আইডিয়া ভাবি'].map((item) => (
              <Pressable
                key={item}
                onPress={() => setDraft(item)}
                style={[styles.suggestion, { borderColor: colors.border, backgroundColor: colors.card }]}
              >
                <Text style={{ color: colors.foreground }}>{item}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={[...messages].reverse()}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          inverted
          contentContainerStyle={styles.messageList}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
          ListFooterComponent={
            settings.autoImprove && settings.onlineAI ? (
              <Pressable
                onPress={requestImprovement}
                disabled={improving || busy}
                style={styles.improveButton}
              >
                {improving ? <ActivityIndicator size="small" color={colors.primary} /> : <Feather name="sliders" size={14} color={colors.primary} />}
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>উন্নতির পরামর্শ</Text>
              </Pressable>
            ) : null
          }
        />
      )}

      {error ? (
        <View style={[styles.errorBox, { backgroundColor: colors.accent }]}>
          <Feather name="info" size={15} color={colors.accentForeground} />
          <Text style={{ color: colors.accentForeground, flex: 1, fontSize: 13, lineHeight: 18 }}>{error}</Text>
        </View>
      ) : null}

      <View
        style={[
          styles.composer,
          {
            borderColor: colors.border,
            backgroundColor: colors.card,
            marginBottom:
              Platform.OS === 'web' ? 84 : Math.max(insets.bottom, 8),
          },
        ]}
      >
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Oi-কে কিছু জিজ্ঞেস করুন…"
          placeholderTextColor={colors.mutedForeground}
          multiline
          maxLength={4000}
          returnKeyType="default"
          style={[styles.input, { color: colors.foreground }]}
          accessibilityLabel="আপনার বার্তা"
        />
        <Pressable
          onPress={() => toggleVoice()}
          accessibilityRole="button"
          accessibilityLabel={listening ? 'ভয়েস টাইপিং বন্ধ করুন' : 'ভয়েসে লিখুন'}
          style={[styles.roundButton, { backgroundColor: listening ? colors.primary : colors.accent }]}
        >
          {listening
            ? <ActivityIndicator size="small" color={colors.primaryForeground} />
            : <Feather name="mic" size={18} color={colors.accentForeground} />}
        </Pressable>
        <Pressable
          onPress={() => toggleReadAloud()}
          accessibilityRole="button"
          accessibilityLabel={speaking ? 'পড়া বন্ধ করুন' : 'শেষ উত্তর পড়ে শোনান'}
          style={[styles.roundButton, { backgroundColor: colors.accent }]}
        >
          <Feather name={speaking ? 'volume-x' : 'volume-2'} size={18} color={colors.accentForeground} />
        </Pressable>
        <Pressable
          onPress={() => void sendMessage(draft)}
          disabled={!draft.trim() || busy}
          accessibilityRole="button"
          accessibilityLabel="বার্তা পাঠান"
          style={[styles.roundButton, { backgroundColor: colors.primary, opacity: !draft.trim() || busy ? 0.5 : 1 }]}
        >
          {busy ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : <Feather name="arrow-up" size={20} color={colors.primaryForeground} />}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  logo: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  brandTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  brandSub: { fontSize: 11, marginTop: 3 },
  iconButton: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  welcome: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingBottom: 18 },
  welcomeMark: { width: 58, height: 58, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 21 },
  welcomeTitle: { fontSize: 24, fontWeight: '700', letterSpacing: -0.7, textAlign: 'center' },
  welcomeText: { fontSize: 15, lineHeight: 23, textAlign: 'center', marginTop: 10, maxWidth: 360 },
  suggestions: { width: '100%', gap: 9, marginTop: 28 },
  suggestion: { borderWidth: 1, borderRadius: 15, paddingVertical: 12, paddingHorizontal: 15 },
  messageList: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 18 },
  messageRow: { width: '100%', alignItems: 'flex-start', marginVertical: 5 },
  userRow: { alignItems: 'flex-end' },
  messageBubble: { maxWidth: '88%', paddingVertical: 11, paddingHorizontal: 14, borderRadius: 18, borderBottomLeftRadius: 5 },
  userBubble: { borderBottomLeftRadius: 18, borderBottomRightRadius: 5 },
  improveButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, padding: 9, marginTop: 5 },
  errorBox: { marginHorizontal: 14, marginBottom: 8, borderRadius: 13, padding: 11, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  composer: { marginHorizontal: 12, borderWidth: 1, borderRadius: 22, minHeight: 56, maxHeight: 138, paddingHorizontal: 9, paddingVertical: 7, flexDirection: 'row', alignItems: 'flex-end', gap: 7 },
  input: { flex: 1, minHeight: 39, maxHeight: 116, paddingHorizontal: 8, paddingTop: 9, paddingBottom: 8, fontSize: 15, lineHeight: 21 },
  roundButton: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
