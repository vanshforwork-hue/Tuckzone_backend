import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Sparkles, Sun } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';

export function WaveFooter() {
  return (
    <View style={styles.motivationalBanner}>
      <View style={styles.motiveRow}>
        <Sparkles size={20} color="#F59E0B" />
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.motiveText1}>Stay Healthy</Text>
          <Text style={styles.motiveText2}>Stay Happy</Text>
        </View>
        <Sun size={26} color="#F59E0B" />
      </View>

      {/* Rolling Landscape Waves SVG */}
      <View style={styles.waveWrap}>
        <Svg viewBox="0 0 375 70" style={styles.waveSvg} preserveAspectRatio="none">
          <Path
            d="M0 45C50 25 110 32 170 48C230 64 290 60 375 35V70H0V45Z"
            fill="#FEDC70"
            opacity={0.85}
          />
          <Path
            d="M0 60C70 30 150 42 220 52C280 60 325 50 375 25V70H0V60Z"
            fill="#58A571"
          />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  motivationalBanner: {
    alignItems: 'center',
    marginTop: 28,
    marginHorizontal: -20,
  },
  motiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 12,
    transform: [{ rotate: '-2deg' }],
  },
  motiveText1: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0A6344',
    textAlign: 'center',
    lineHeight: 24,
  },
  motiveText2: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0A6344',
    textAlign: 'center',
    lineHeight: 24,
  },
  waveWrap: {
    width: '100%',
    height: 70,
    marginTop: 8,
  },
  waveSvg: {
    width: '100%',
    height: '100%',
  },
});
