// src/components/SensorChart.tsx
import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { ChartDataPoint } from '../models/TelemetryModels';
import { spacing, radius } from '../utils/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface SensorChartProps {
  title: string;
  unit: string;
  data: ChartDataPoint[];
  color: string;
  startFillColor: string;
  endFillColor: string;
  icon: string;
  minValue?: number;
  maxValue?: number;
  isLoading?: boolean;
}

export function SensorChart({
  title, unit, data, color, startFillColor, endFillColor,
  icon, minValue, maxValue, isLoading
}: SensorChartProps) {
  const chartWidth = SCREEN_WIDTH - spacing.md * 4 - 20;

  if (isLoading || data.length === 0) {
    return (
      <View style={[styles.card, { borderColor: color }]}>
        <View style={styles.header}>
          <Text style={styles.icon}>{icon}</Text>
          <Text style={[styles.title, { color }]}>{title}</Text>
        </View>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            {isLoading ? 'Indlæser data…' : 'Ingen data tilgængelig'}
          </Text>
        </View>
      </View>
    );
  }

  // Sample labels: show max 6 evenly spaced
  const labelStep = Math.max(1, Math.floor(data.length / 6));
  const chartData = data.map((point, i) => ({
    value: point.value,
    label: i % labelStep === 0 ? point.label : '',
    dataPointText: undefined,
  }));

  const values = data.map(d => d.value);
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const yMin = minValue ?? Math.floor(dataMin - 2);
  const yMax = maxValue ?? Math.ceil(dataMax + 2);

  return (
    <View style={[styles.card, { borderColor: color + '40' }]}>
      <View style={styles.header}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={[styles.title, { color }]}>{title}</Text>
        <Text style={styles.range}>
          {dataMin}{unit} – {dataMax}{unit}
        </Text>
      </View>
      <LineChart
        data={chartData}
        width={chartWidth}
        height={160}
        color={color}
        thickness={2}
        startFillColor={startFillColor}
        endFillColor={endFillColor}
        startOpacity={0.3}
        endOpacity={0.01}
        areaChart
        curved
        hideDataPoints
        xAxisColor={'#30363D'}
        yAxisColor={'#30363D'}
        yAxisTextStyle={{ color: '#484F58', fontSize: 10 }}
        xAxisLabelTextStyle={{ color: '#484F58', fontSize: 9 }}
        backgroundColor={'transparent'}
        noOfSections={4}
        maxValue={yMax}
        minValue={yMin}
        hideRules={false}
        rulesColor={'#21262D'}
        rulesType="solid"
        showStripOnHighlight
        stripColor={color}
        stripOpacity={0.2}
        focusEnabled
        showTextOnFocus
        textShiftY={-8}
        textColor={color}
        textFontSize={11}
        initialSpacing={10}
        endSpacing={10}
        pointerConfig={{
          pointerStripHeight: 140,
          pointerStripColor: color,
          pointerStripWidth: 1,
          pointerColor: color,
          radius: 5,
          pointerLabelWidth: 80,
          pointerLabelHeight: 38,
          activatePointersOnLongPress: false,
          autoAdjustPointerLabelPosition: true,
          pointerLabelComponent: (items: any[]) => (
            <View style={[styles.tooltip, { borderColor: color }]}>
              <Text style={[styles.tooltipValue, { color }]}>
                {items[0]?.value}{unit}
              </Text>
            </View>
          ),
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#161B22',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  icon: {
    fontSize: 18,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    flex: 1,
  },
  range: {
    color: '#484F58',
    fontSize: 11,
    fontWeight: '500',
  },
  placeholder: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: '#484F58',
    fontSize: 13,
  },
  tooltip: {
    backgroundColor: '#21262D',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
  },
  tooltipValue: {
    fontSize: 13,
    fontWeight: '700',
  },
});
