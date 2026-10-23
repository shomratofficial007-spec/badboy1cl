import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAssistant } from '@/context/AssistantContext';
import { useColors } from '@/hooks/useColors';
import {
  checkTelegramMessages,
  connectTelegramBot,
  disconnectTelegramBot,
  hasTelegramBot,
  sendTelegramMessage,
} from '@/lib/assistant/telegram';

interface LocalTelegramMessage {
  id: number;
  chatId: number;
  sender: string;
  text: string;
  date: number;
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { settings, updateSettings, clearChat } = useAssistant();
  const [personalityDraft, setPersonalityDraft] = useState(settings.personality);
  const [botTokenDraft, setBotTokenDraft] = useState('');
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [botUsername, setBotUsername] = useState('');
  const [telegramMessage, setTelegramMessage] = useState('');
  const [telegramItems, setTelegramItems] = useState<LocalTelegramMessage[]>([]);
  const [telegramBusy, setTelegramBusy] = useState(false);
  const [telegramError, setTelegramError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    hasTelegramBot().then((connected) => {
      if (active) setTelegramConnected(connected);
    }).catch(() => {
      if (active) setTelegramError('ফোনের নিরাপদ স্টোরেজ পরীক্ষা করা যায়নি।');
    });
    return () => { active = false; };
  }, []);

  const connectBot = () => {
    const token = botTokenDraft.trim();
    if (!token || telegramBusy) return;
    Alert.alert(
      'Telegram bot সংযোগ করবেন?',
      'Bot token ফোনের Secure Storage-এ থাকবে এবং সংযোগ যাচাই করতে সরাসরি Telegram-এ পাঠানো হবে। আপনার চ্যাট বার্তা এই অ্যাপের সার্ভারে যাবে না।',
      [
        { text: 'বাতিল', style: 'cancel' },
        {
          text: 'সংযোগ করুন',
          onPress: () => {
            setTelegramBusy(true);
            setTelegramError(null);
            void connectTelegramBot(token)
              .then((bot) => {
                setTelegramConnected(true);
                setBotUsername(bot.username);
                setBotTokenDraft('');
              })
              .catch((cause) => setTelegramError(cause instanceof Error ? cause.message : 'Bot সংযোগ করা যায়নি।'))
              .finally(() => setTelegramBusy(false));
          },
        },
      ],
    );
  };

  const disconnectBot = () => {
    Alert.alert(
      'Telegram সংযোগ বিচ্ছিন্ন করবেন?',
      'এই ফোনে রাখা bot token মুছে যাবে।',
      [
        { text: 'বাতিল', style: 'cancel' },
        {
          text: 'বিচ্ছিন্ন করুন',
          style: 'destructive',
          onPress: () => {
            void disconnectTelegramBot().then(() => {
              setTelegramConnected(false);
              setBotUsername('');
              setTelegramItems([]);
            }).catch(() => setTelegramError('Bot token মুছতে সমস্যা হয়েছে।'));
          },
        },
      ],
    );
  };

  const refreshTelegram = async () => {
    setTelegramBusy(true);
    setTelegramError(null);
    try {
      const messages = await checkTelegramMessages();
      if (messages.length) setTelegramItems((previous) => [...messages, ...previous].slice(0, 12));
      else setTelegramError('নতুন বার্তা নেই। Bot-এ /start পাঠিয়ে আবার দেখুন।');
    } catch (cause) {
      setTelegramError(cause instanceof Error ? cause.message : 'Telegram inbox খোলা যায়নি।');
    } finally {
      setTelegramBusy(false);
    }
  };

  const sendTelegram = () => {
    const text = telegramMessage.trim();
    if (!text || telegramBusy) return;
    Alert.alert(
      'Telegram-এ পাঠাবেন?',
      'এই বার্তাটি আপনার সংযুক্ত bot-এর সর্বশেষ chat-এ পাঠানো হবে।',
      [
        { text: 'বাতিল', style: 'cancel' },
        {
          text: 'পাঠান',
          onPress: () => {
            setTelegramBusy(true);
            setTelegramError(null);
            void sendTelegramMessage(text)
              .then(() => setTelegramMessage(''))
              .catch((cause) => setTelegramError(cause instanceof Error ? cause.message : 'বার্তা পাঠানো যায়নি।'))
              .finally(() => setTelegramBusy(false));
          },
        },
      ],
    );
  };

  const sectionCard = { backgroundColor: colors.card, borderColor: colors.border };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 12) + 14, paddingBottom: Math.max(insets.bottom, 20) + 90 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.eyebrow, { color: colors.primary }]}>আপনার নিয়ন্ত্রণে</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>সেটিংস</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        কী শেয়ার হবে, কোন ফিচার চালু থাকবে—সবকিছু এখানে ঠিক করুন।
      </Text>

      <View style={[styles.section, sectionCard]}>
        <View style={styles.sectionTitleRow}>
          <Feather name="wifi" size={17} color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>AI ও গোপনীয়তা</Text>
        </View>
        <SettingSwitch
          colors={colors}
          title="অনলাইন AI"
          subtitle={settings.onlineAI ? 'শুধু এই মুহূর্তের বার্তাটি AI-কে পাঠানো হয়।' : 'অফলাইনে chat ও মেমোরি এই ফোনেই থাকে; AI উত্তর বন্ধ।'}
          value={settings.onlineAI}
          onValueChange={(value) => updateSettings({ onlineAI: value })}
        />
        <View style={[styles.rule, { backgroundColor: colors.border }]} />
        <Text style={[styles.label, { color: colors.foreground }]}>Assistant personality</Text>
        <TextInput
          value={personalityDraft}
          onChangeText={setPersonalityDraft}
          placeholder="কেমনভাবে উত্তর দেবে?"
          placeholderTextColor={colors.mutedForeground}
          multiline
          maxLength={1000}
          style={[styles.personalityInput, { color: colors.foreground, borderColor: colors.input }]}
          accessibilityLabel="Assistant-এর ব্যক্তিত্ব"
        />
        <Pressable
          onPress={() => {
            updateSettings({ personality: personalityDraft.trim() || 'Warm, clear, and practical.' });
            Alert.alert('সংরক্ষিত', 'আপনার assistant personality এই ফোনে সংরক্ষণ করা হয়েছে।');
          }}
          style={[styles.secondaryButton, { backgroundColor: colors.secondary }]}
        >
          <Text style={{ color: colors.secondaryForeground, fontWeight: '700' }}>ব্যক্তিত্ব সংরক্ষণ</Text>
        </Pressable>
      </View>

      <View style={[styles.section, sectionCard]}>
        <View style={styles.sectionTitleRow}>
          <Feather name="refresh-cw" size={17} color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Auto-Improve</Text>
        </View>
        <SettingSwitch
          colors={colors}
          title="পরামর্শ দেখান"
          subtitle="শুধু বর্তমান বার্তার ভিত্তিতে পরামর্শ দেবে। আপনার অনুমতি ছাড়া personality বদলাবে না।"
          value={settings.autoImprove}
          onValueChange={(value) => updateSettings({ autoImprove: value })}
        />
      </View>

      <View style={[styles.section, sectionCard]}>
        <View style={styles.sectionTitleRow}>
          <Feather name="code" size={17} color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Develop by My Instructions</Text>
        </View>
        <SettingSwitch
          colors={colors}
          title="Develop mode"
          subtitle="কোড, পরিকল্পনা ও bug-fix নিয়ে কাজ করবে। ঝুঁকিপূর্ণ পরিবর্তন বা permission বদলানোর আগে অনুমতি চাইবে।"
          value={settings.developerMode}
          onValueChange={(value) => updateSettings({ developerMode: value })}
        />
        <Text style={[styles.smallNote, { color: colors.mutedForeground }]}>
          এই মোড নির্দেশনা ও code draft দিতে পারে; এই অ্যাপের ভেতর থেকে Replit workspace-এ সরাসরি ফাইল বদলানোর সংযোগ এখনো নেই।
        </Text>
      </View>

      <View style={[styles.section, sectionCard]}>
        <View style={styles.sectionTitleRow}>
          <Feather name="mic" size={17} color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>ভয়েস ও “Oi”</Text>
        </View>
        <SettingSwitch
          colors={colors}
          title="ভয়েস সম্মতি"
          subtitle="চালু থাকলে ব্রাউজারে ভয়েস টাইপিং ও পড়ে শোনানো ব্যবহার করা যাবে। ভয়েস টাইপিংয়ে আপনার কণ্ঠ ব্রাউজারের speech service-এ পাঠানো হয়।"
          value={settings.voiceProcessingConsent}
          onValueChange={(value) => updateSettings({ voiceProcessingConsent: value })}
        />
        <View style={[styles.rule, { backgroundColor: colors.border }]} />
        <Text style={[styles.body, { color: colors.mutedForeground }]}>
          নির্বাচিত OpenRouter free model সরাসরি অডিও বার্তা নিতে পারে না, তাই চ্যাটে মাইক চাপলে ব্রাউজারের ভয়েস টাইপিং লেখায় রূপ নেয়; স্পিকার চাপলে শেষ উত্তর ডিভাইসেই পড়ে শোনানো হয়।
        </Text>
        <View style={[styles.wakeCard, { backgroundColor: colors.accent }]}>
          <Feather name="moon" size={16} color={colors.accentForeground} />
          <Text style={[styles.wakeText, { color: colors.accentForeground }]}>
            “Oi” ব্যাকগ্রাউন্ড wake word এখনো চালু নয়। এর জন্য আলাদা native wake-word engine ও custom model দরকার; কেবল রেকর্ডিং permission দিয়ে ফোন সারাক্ষণ শুনবে না।
          </Text>
        </View>
        <Text style={[styles.smallNote, { color: colors.mutedForeground }]}>
          Microphone background recording permission build-এ রাখা আছে, তবে wake-word detector যোগ না হওয়া পর্যন্ত background listening শুরু হবে না।
        </Text>
      </View>

      <View style={[styles.section, sectionCard]}>
        <View style={styles.sectionTitleRow}>
          <Feather name="send" size={17} color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Telegram bot</Text>
        </View>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>
          নিজের bot token দিন। Token এই ফোনের Secure Storage-এ থাকবে। এটি bot-এর DM সমর্থন করে—ব্যক্তিগত Telegram chat পড়ে না।
        </Text>
        {telegramConnected ? (
          <>
            <View style={[styles.connectedPill, { backgroundColor: colors.secondary }]}>
              <View style={[styles.dot, { backgroundColor: colors.primary }]} />
              <Text style={{ color: colors.secondaryForeground, fontSize: 13, fontWeight: '600' }}>
                সংযুক্ত {botUsername ? `· @${botUsername}` : '· এই ডিভাইসে'}
              </Text>
            </View>
            <Pressable
              onPress={() => void refreshTelegram()}
              disabled={telegramBusy}
              style={[styles.secondaryButton, { backgroundColor: colors.secondary, marginTop: 12 }]}
            >
              {telegramBusy ? <ActivityIndicator size="small" color={colors.secondaryForeground} /> : <Feather name="inbox" size={16} color={colors.secondaryForeground} />}
              <Text style={{ color: colors.secondaryForeground, fontWeight: '700' }}>Inbox দেখুন</Text>
            </Pressable>
            <Text style={[styles.smallNote, { color: colors.mutedForeground }]}>
              প্রথমে Telegram-এ আপনার bot-কে /start পাঠান। নতুন বার্তা শুধু আপনি “Inbox দেখুন” চাপলে আনা হবে।
            </Text>
            {telegramItems.map((item) => (
              <View key={item.id} style={[styles.telegramItem, { borderColor: colors.border }]}>
                <Text style={[styles.messageSender, { color: colors.foreground }]}>{item.sender}</Text>
                <Text style={[styles.body, { color: colors.mutedForeground }]}>{item.text}</Text>
              </View>
            ))}
            <TextInput
              value={telegramMessage}
              onChangeText={setTelegramMessage}
              placeholder="Bot-এ বার্তা লিখুন"
              placeholderTextColor={colors.mutedForeground}
              maxLength={4000}
              style={[styles.telegramInput, { color: colors.foreground, borderColor: colors.input }]}
            />
            <Pressable
              onPress={sendTelegram}
              disabled={!telegramMessage.trim() || telegramBusy}
              style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: !telegramMessage.trim() || telegramBusy ? 0.5 : 1 }]}
            >
              <Feather name="send" size={15} color={colors.primaryForeground} />
              <Text style={{ color: colors.primaryForeground, fontWeight: '700' }}>অনুমতি দিয়ে পাঠান</Text>
            </Pressable>
            <Pressable onPress={disconnectBot} style={styles.textButton}>
              <Text style={{ color: colors.destructive, fontWeight: '600' }}>Bot বিচ্ছিন্ন করুন</Text>
            </Pressable>
          </>
        ) : (
          <>
            <TextInput
              value={botTokenDraft}
              onChangeText={setBotTokenDraft}
              placeholder="Bot token"
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.telegramInput, { color: colors.foreground, borderColor: colors.input }]}
              accessibilityLabel="Telegram bot token"
            />
            <Pressable
              onPress={connectBot}
              disabled={!botTokenDraft.trim() || telegramBusy}
              style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: !botTokenDraft.trim() || telegramBusy ? 0.5 : 1 }]}
            >
              {telegramBusy ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : <Feather name="link" size={15} color={colors.primaryForeground} />}
              <Text style={{ color: colors.primaryForeground, fontWeight: '700' }}>Bot সংযোগ করুন</Text>
            </Pressable>
          </>
        )}
        {telegramError ? <Text style={[styles.errorText, { color: colors.destructive }]}>{telegramError}</Text> : null}
      </View>

      <Pressable
        onPress={() => Alert.alert('চ্যাট ইতিহাস মুছবেন?', 'এই ফোনে সংরক্ষিত সব chat history মুছে যাবে।', [
          { text: 'বাতিল', style: 'cancel' },
          { text: 'মুছুন', style: 'destructive', onPress: () => void clearChat() },
        ])}
        style={[styles.dangerButton, { borderColor: colors.border }]}
      >
        <Feather name="trash-2" size={16} color={colors.destructive} />
        <Text style={{ color: colors.destructive, fontWeight: '700' }}>চ্যাট ইতিহাস মুছুন</Text>
      </Pressable>
    </ScrollView>
  );
}

function SettingSwitch({
  colors,
  title,
  subtitle,
  value,
  onValueChange,
}: {
  colors: ReturnType<typeof useColors>;
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <View style={styles.switchCopy}>
        <Text style={[styles.label, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.card}
        accessibilityLabel={title}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, gap: 13 },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 0.7, marginTop: 0 },
  title: { fontSize: 29, fontWeight: '700', letterSpacing: -0.7, marginTop: -8 },
  subtitle: { fontSize: 14, lineHeight: 21, marginTop: -5, marginBottom: 7 },
  section: { borderWidth: 1, borderRadius: 21, padding: 15 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 5 },
  switchCopy: { flex: 1, gap: 4 },
  label: { fontSize: 14, fontWeight: '700' },
  body: { fontSize: 13, lineHeight: 19 },
  rule: { height: 1, marginVertical: 12 },
  personalityInput: { borderWidth: 1, borderRadius: 13, minHeight: 90, marginTop: 9, padding: 11, textAlignVertical: 'top', fontSize: 14, lineHeight: 20 },
  secondaryButton: { minHeight: 43, borderRadius: 13, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10 },
  smallNote: { fontSize: 12, lineHeight: 18, marginTop: 10 },
  wakeCard: { flexDirection: 'row', gap: 9, borderRadius: 13, padding: 11, marginTop: 13 },
  wakeText: { flex: 1, fontSize: 12, lineHeight: 18 },
  connectedPill: { flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 8, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 20 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  telegramInput: { borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 11, marginTop: 12, fontSize: 14 },
  primaryButton: { minHeight: 44, borderRadius: 13, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10 },
  textButton: { alignSelf: 'center', padding: 12, marginTop: 2 },
  telegramItem: { borderBottomWidth: 1, paddingVertical: 10 },
  messageSender: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  errorText: { fontSize: 12, lineHeight: 18, marginTop: 9 },
  dangerButton: { borderWidth: 1, borderRadius: 14, minHeight: 46, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8 },
});
