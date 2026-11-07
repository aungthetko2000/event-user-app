import { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TextInput, FlatList, TouchableOpacity,
  ActivityIndicator, StatusBar, Platform, Animated
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const API_URL = 'http://192.168.1.37:8000/get_events.php';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const PALETTE = [
  ['#6C4DFF', '#9B7BFF'],
  ['#FF6B6B', '#FF9E7A'],
  ['#12B5A6', '#4FD8C4'],
  ['#FF9F1C', '#FFC857'],
  ['#2D7DFF', '#62A8FF'],
];

const parseDate = (dateStr) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr || '');
  if (!m) return { day: '–', month: '' };
  return { day: String(parseInt(m[3], 10)), month: MONTHS[parseInt(m[2], 10) - 1] || '' };
};

function EventCard({ item, index, isFav, onToggle }) {
  const enter = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const colors = PALETTE[index % PALETTE.length];
  const { day, month } = parseDate(item.date);
  const initial = (item.organiser || '?').trim().charAt(0).toUpperCase();

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1, duration: 450, delay: Math.min(index, 8) * 70, useNativeDriver: true,
    }).start();
  }, []);

  const handleFav = () => {
    Animated.sequence([
      Animated.spring(pop, { toValue: 1.35, speed: 40, bounciness: 14, useNativeDriver: true }),
      Animated.spring(pop, { toValue: 1, speed: 20, bounciness: 8, useNativeDriver: true }),
    ]).start();
    onToggle(item.id);
  };

  return (
    <Animated.View
      style={[
        styles.card,
        { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] },
      ]}
    >
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.dateBadge}>
        <Text style={styles.dateDay}>{day}</Text>
        <Text style={styles.dateMonth}>{month}</Text>
      </LinearGradient>

      <View style={styles.cardBody}>
        <Text style={styles.eventName} numberOfLines={2}>{item.name}</Text>

        <View style={[styles.locationPill, { backgroundColor: colors[0] + '18' }]}>
          <Text style={[styles.locationText, { color: colors[0] }]} numberOfLines={1}>📍 {item.location}</Text>
        </View>

        {item.description ? (
          <Text style={styles.eventDesc} numberOfLines={2}>{item.description}</Text>
        ) : null}

        {/* Render Sessions & Start Times */}
        {item.sessions && item.sessions.length > 0 ? (
          <View style={styles.sessionContainer}>
            <Text style={styles.sessionHeader}>⏰ Sessions & Start Times:</Text>
            {item.sessions.map((sess, idx) => (
              <View key={idx} style={styles.sessionRow}>
                <Text style={styles.sessionText}>• {sess.session_name}</Text>
                <Text style={styles.sessionSubText}>
                  🕒 {sess.session_time} {sess.session_room ? `| 📍 Room: ${sess.session_room}` : ''}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.sessionSubText}>⏰ Time: Schedule TBD</Text>
        )}

        <View style={styles.organiserRow}>
          <View style={[styles.avatar, { backgroundColor: colors[0] }]}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.organiserText} numberOfLines={1}>{item.organiser}</Text>
        </View>
      </View>

      <TouchableOpacity onPress={handleFav} hitSlop={10} activeOpacity={0.8}>
        <Animated.View style={[styles.favButton, isFav && styles.favButtonActive, { transform: [{ scale: pop }] }]}>
          <Text style={[styles.favIcon, isFav && styles.favIconActive]}>{isFav ? '♥' : '♡'}</Text>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function App() {
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateQuery, setDateQuery] = useState('');
  const [favorites, setFavorites] = useState([]);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
    loadFavorites();
  }, []);

  useEffect(() => {
    let result = Array.isArray(events) ? events : [];

    if (showOnlyFavorites) {
      result = result.filter(event => favorites.includes(event.id));
    }

    if (searchQuery.trim() !== '') {
      result = result.filter(event =>
        event.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (dateQuery.trim() !== '') {
      result = result.filter(event => event.date?.includes(dateQuery.trim()));
    }

    setFilteredEvents(result);
  }, [searchQuery, dateQuery, events, favorites, showOnlyFavorites]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const response = await fetch(API_URL);
      const data = await response.json();
      
      const eventArray = Array.isArray(data) ? data : [];
      setEvents(eventArray);
      setFilteredEvents(eventArray);
    } catch (error) {
      console.error('Failed to fetch events from cloud:', error);
      setEvents([]);
      setFilteredEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const loadFavorites = async () => {
    try {
      const storedFavs = await AsyncStorage.getItem('@favorite_events');
      if (storedFavs) {
        setFavorites(JSON.parse(storedFavs));
      }
    } catch (error) {
      console.error('Failed to load favorites', error);
    }
  };

  const toggleFavorite = async (eventId) => {
    try {
      let updatedFavs;
      if (favorites.includes(eventId)) {
        updatedFavs = favorites.filter(id => id !== eventId);
      } else {
        updatedFavs = [...favorites, eventId];
      }
      setFavorites(updatedFavs);
      await AsyncStorage.setItem('@favorite_events', JSON.stringify(updatedFavs));
    } catch (error) {
      console.error('Failed to save favorite', error);
    }
  };

  const header = (
    <View>
      <LinearGradient
        colors={['#1E1257', '#4B30D6', '#8C5CFF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.blobA} />
        <View style={styles.blobB} />

        <View style={styles.statsRow}>
          <View style={styles.statChip}>
            <Text style={styles.statNumber}>{events.length}</Text>
            <Text style={styles.statLabel}>events</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statNumber}>{favorites.length}</Text>
            <Text style={styles.statLabel}>saved</Text>
          </View>
        </View>

        <View style={styles.glassInput}>
          <Ionicons name="search" size={20} color="rgba(255,255,255,0.85)" style={styles.inputIcon} />
          <TextInput
            style={styles.glassText}
            placeholder="Search events"
            placeholderTextColor="rgba(255,255,255,0.6)"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={10}>
              <Text style={styles.clear}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.glassInput}>
          <Ionicons name="calendar-outline" size={20} color="rgba(255,255,255,0.85)" style={styles.inputIcon} />
          <TextInput
            style={styles.glassText}
            placeholder="Filter by date (YYYY-MM-DD)"
            placeholderTextColor="rgba(255,255,255,0.6)"
            value={dateQuery}
            onChangeText={setDateQuery}
          />
          {dateQuery.length > 0 && (
            <TouchableOpacity onPress={() => setDateQuery('')} hitSlop={10}>
              <Text style={styles.clear}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.tabButton, !showOnlyFavorites && styles.activeTab]}
          onPress={() => setShowOnlyFavorites(false)}
        >
          <Text style={[styles.tabText, !showOnlyFavorites && styles.activeTabText]}>All events</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.tabButton, showOnlyFavorites && styles.activeTab]}
          onPress={() => setShowOnlyFavorites(true)}
        >
          <Text style={[styles.tabText, showOnlyFavorites && styles.activeTabText]}>♥ Saved ({favorites.length})</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <FlatList
        data={loading ? [] : filteredEvents}
        keyExtractor={(item, index) => (item.id ? item.id.toString() : index.toString())}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        renderItem={({ item, index }) => (
          <EventCard
            item={item}
            index={index}
            isFav={favorites.includes(item.id)}
            onToggle={toggleFavorite}
          />
        )}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color="#5B3DF5" style={{ marginTop: 48 }} />
          ) : (
            <View style={styles.empty}>
              <View style={styles.emptyCircle}>
                <Text style={styles.emptyEmoji}>{showOnlyFavorites ? '♡' : '🗓️'}</Text>
              </View>
              <Text style={styles.emptyTitle}>
                {showOnlyFavorites ? 'No saved events yet' : 'No events found'}
              </Text>
              <Text style={styles.emptyText}>
                {showOnlyFavorites
                  ? 'Tap the heart on any event to save it here.'
                  : 'Try a different name or clear the date filter.'}
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

const C = {
  bg: '#F5F3FC',
  surface: '#FFFFFF',
  ink: '#17133A',
  body: '#5A5679',
  muted: '#9C99B8',
  accent: '#5B3DF5',
  heart: '#FF4F6D',
  heartSoft: '#FFE8EC',
};

const shadow = Platform.select({
  ios: { shadowColor: '#3A27B5', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
  android: { elevation: 4 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  listContainer: { paddingBottom: 40 },

  // Hero
  hero: {
    paddingTop: Platform.OS === 'ios' ? 64 : (StatusBar.currentHeight || 24) + 20,
    paddingHorizontal: 22,
    paddingBottom: 26,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    overflow: 'hidden',
  },
  blobA: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.08)', top: -60, right: -70 },
  blobB: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.07)', bottom: 40, left: -50 },

  statsRow: { flexDirection: 'row', marginTop: 18, marginBottom: 20 },
  statChip: {
    flexDirection: 'row', alignItems: 'baseline',
    backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 8, marginRight: 10,
  },
  statNumber: { fontSize: 18, fontWeight: '800', color: '#FFF', marginRight: 6 },
  statLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },

  glassInput: {
    flexDirection: 'row', alignItems: 'center', height: 52,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 16, paddingHorizontal: 16, marginBottom: 10,
  },
  inputIcon: { marginRight: 10 },
  glassText: { flex: 1, fontSize: 15, color: '#FFF', paddingVertical: 0 },
  clear: { fontSize: 14, color: 'rgba(255,255,255,0.8)', paddingLeft: 10 },

  // Tabs
  tabContainer: {
    flexDirection: 'row', marginHorizontal: 20, marginTop: 20, marginBottom: 18,
    backgroundColor: '#E8E4F7', borderRadius: 16, padding: 4,
  },
  tabButton: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 13 },
  activeTab: { backgroundColor: C.surface, ...shadow },
  tabText: { fontSize: 14, fontWeight: '700', color: C.body },
  activeTabText: { color: C.accent },

  // Card
  card: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: C.surface, borderRadius: 24, padding: 14,
    marginHorizontal: 20, marginBottom: 16, ...shadow,
  },
  dateBadge: { width: 62, height: 74, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dateDay: { fontSize: 28, fontWeight: '800', color: '#FFF', lineHeight: 32 },
  dateMonth: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.85)', letterSpacing: 1.2 },

  cardBody: { flex: 1, marginHorizontal: 12 },
  eventName: { fontSize: 17, fontWeight: '800', color: C.ink, letterSpacing: -0.3 },
  locationPill: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, marginTop: 8 },
  locationText: { fontSize: 12, fontWeight: '700' },
  eventDesc: { fontSize: 13, lineHeight: 19, color: C.body, marginTop: 8 },
  
  // Sessions Styling
  sessionContainer: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F0EEF8' },
  sessionHeader: { fontSize: 12, fontWeight: '800', color: C.accent, marginBottom: 4 },
  sessionRow: { marginBottom: 4 },
  sessionText: { fontSize: 13, fontWeight: '700', color: C.ink },
  sessionSubText: { fontSize: 11, color: C.body },

  organiserRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  avatar: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  avatarTest: { fontSize: 11, fontWeight: '800', color: '#FFF' },
  organiserText: { flex: 1, fontSize: 12, color: C.muted, fontWeight: '600' },

  favButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1EEFC', alignItems: 'center', justifyContent: 'center' },
  favButtonActive: { backgroundColor: C.heartSoft },
  favIcon: { fontSize: 21, color: C.accent, marginTop: -1 },
  favIconActive: { color: C.heart },

  empty: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 36 },
  emptyCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#E8E4F7', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  emptyEmoji: { fontSize: 40, color: C.accent },
  emptyTitle: { fontSize: 19, fontWeight: '800', color: C.ink, marginBottom: 6 },
  emptyText: { fontSize: 14, color: C.body, textAlign: 'center', lineHeight: 20 },
});