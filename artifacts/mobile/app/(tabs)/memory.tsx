import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAssistant } from '@/context/AssistantContext';
import { useColors } from '@/hooks/useColors';

export default function MemoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { memories, saveMemory, deleteMemory, storageError } = useAssistant();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  const confirmSave = () => {
    const cleanTitle = title.trim();
    const cleanContent = content.trim();
    if (!cleanTitle || !cleanContent || saving) return;
    Alert.alert(
      'মেমোরিতে সংরক্ষণ করবেন?',
      'এই নোটটি ফোনের Secure Storage-এ থাকবে। AI-র কাছে পাঠানো হবে না।',
      [
        { text: 'বাতিল', style: 'cancel' },
        {
          text: 'সংরক্ষণ',
          onPress: () => {
            setSaving(true);
            void saveMemory(cleanTitle, cleanContent)
              .then(() => {
                setTitle('');
                setContent('');
              })
              .catch(() => Alert.alert('সংরক্ষণ করা যায়নি', 'ফোনের নিরাপদ স্টোরেজে জায়গা আছে কি না দেখুন।'))
              .finally(() => setSaving(false));
          },
        },
      ],
    );
  };

  const confirmDelete = (id: string) => {
    Alert.alert(
      'নোট মুছবেন?',
      'এই নোটটি ফোন থেকে স্থায়ীভাবে মুছে যাবে।',
      [
        { text: 'বাতিল', style: 'cancel' },
        {
          text: 'মুছুন',
          style: 'destructive',
          onPress: () => {
            void deleteMemory(id).catch(() =>
              Alert.alert('মুছতে সমস্যা হয়েছে', 'আবার চেষ্টা করুন।'),
            );
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 12) + 14, paddingBottom: Math.max(insets.bottom, 20) + 90 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.eyebrow, { color: colors.primary }]}>শুধু আপনার ফোনে</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>প্রাইভেট মেমোরি</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        এখানে সেভ করা নোট Secure Storage-এ থাকে। অনলাইন উত্তরে মেমোরি কখনো পাঠানো হয় না।
      </Text>

      <View style={[styles.form, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.foreground }]}>নতুন নোট</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="শিরোনাম"
          placeholderTextColor={colors.mutedForeground}
          maxLength={80}
          style={[styles.titleInput, { color: colors.foreground, borderColor: colors.input }]}
          accessibilityLabel="নোটের শিরোনাম"
        />
        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder="আপনি কী মনে রাখতে চান?"
          placeholderTextColor={colors.mutedForeground}
          multiline
          maxLength={2000}
          style={[styles.noteInput, { color: colors.foreground, borderColor: colors.input }]}
          accessibilityLabel="নোটের লেখা"
        />
        <Pressable
          onPress={confirmSave}
          disabled={!title.trim() || !content.trim() || saving}
          style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: !title.trim() || !content.trim() || saving ? 0.5 : 1 }]}
        >
          <Feather name="lock" size={16} color={colors.primaryForeground} />
          <Text style={{ color: colors.primaryForeground, fontWeight: '700' }}>{saving ? 'সংরক্ষণ হচ্ছে…' : 'নিরাপদে সংরক্ষণ'}</Text>
        </Pressable>
      </View>

      {storageError ? (
        <Text style={{ color: colors.destructive, fontSize: 13, marginTop: 12 }}>{storageError}</Text>
      ) : null}

      <View style={styles.listHeading}>
        <Text style={[styles.label, { color: colors.foreground }]}>আপনার নোট</Text>
        <Text style={[styles.count, { color: colors.mutedForeground }]}>{memories.length}</Text>
      </View>
      {memories.length ? memories.map((note) => (
        <View key={note.id} style={[styles.noteCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.noteTop}>
            <Text style={[styles.noteTitle, { color: colors.foreground }]}>{note.title}</Text>
            <Pressable
              onPress={() => confirmDelete(note.id)}
              accessibilityRole="button"
              accessibilityLabel={`${note.title} নোট মুছুন`}
              hitSlop={8}
            >
              <Feather name="trash-2" size={17} color={colors.mutedForeground} />
            </Pressable>
          </View>
          <Text style={[styles.noteBody, { color: colors.mutedForeground }]}>{note.content}</Text>
          <Text style={[styles.date, { color: colors.mutedForeground }]}>
            {new Date(note.createdAt).toLocaleDateString('bn-BD')}
          </Text>
        </View>
      )) : (
        <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="bookmark" size={19} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>এখনো কোনো নোট সেভ করা হয়নি।</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18 },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 0.7, textTransform: 'uppercase' },
  title: { fontSize: 29, fontWeight: '700', letterSpacing: -0.7, marginTop: 6 },
  subtitle: { fontSize: 14, lineHeight: 21, marginTop: 8 },
  form: { borderWidth: 1, borderRadius: 22, padding: 15, marginTop: 24 },
  label: { fontSize: 15, fontWeight: '700' },
  titleInput: { borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, marginTop: 13 },
  noteInput: { borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, minHeight: 94, textAlignVertical: 'top', marginTop: 9 },
  primaryButton: { minHeight: 46, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 12 },
  listHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 25, marginBottom: 11 },
  count: { fontSize: 12, fontWeight: '600' },
  noteCard: { borderWidth: 1, borderRadius: 18, padding: 14, marginBottom: 10 },
  noteTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  noteTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  noteBody: { fontSize: 14, lineHeight: 21, marginTop: 8 },
  date: { fontSize: 11, marginTop: 10 },
  empty: { borderWidth: 1, borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 10 },
  emptyText: { fontSize: 13 },
});
