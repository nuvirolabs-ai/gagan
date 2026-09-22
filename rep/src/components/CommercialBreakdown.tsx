import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../theme";

export const entityName = (entity:string) => entity === "jain_traders" ? "Jain Traders" : "Padam International";
/** Presentation only: all monetary amounts come from the backend snapshot. */
export default function CommercialBreakdown({value}:{value:any}) {
  if (!value) return null;
  const grouped = ["jain_traders", "padam_international"].map(entity => ({
    entity,
    lines: value.lines.filter((line:any) => line.entity === entity),
  })).filter(group => group.lines.length);
  return <View style={styles.panel}>
    <Text style={styles.heading}>Commercial breakdown</Text>
    {value.taxStatus === "PENDING" || value.gstPending ? <Text style={styles.text}>GST pending — final tax will be applied before invoicing.</Text> : null}
    {value.routing ? <View style={styles.routing}>
      <Text style={styles.heading}>Routing · {value.routing.destination === "INDORE_CITY" ? "Indore City" : "Outside Indore"}</Text>
      <Text style={styles.text}>{value.routing.explanation}</Text>
      <Text style={styles.text}>Eligible threshold contribution: {value.routing.eligibleContributionBags} bags</Text>
    </View> : null}
    {grouped.map(group => <View key={group.entity} style={styles.group}>
      <Text style={styles.entity}>{entityName(group.entity)}</Text>
      {group.lines.map((line:any)=><View key={line.variantId} style={styles.line}>
        <Text style={styles.heading}>{line.productName ?? line.variantId}</Text>
        <Text style={styles.text}>{line.pack}</Text>
        <Text style={styles.text}>{line.cases} cases · {line.weightKg} kg · {line.quintals} quintals</Text>
        <Text style={styles.text}>₹{line.rate} / {line.rateBasis} · Base ₹{line.base}</Text>
        {line.gstPending || line.gstPercent == null ? <Text style={styles.text}>GST pending — final tax will be applied before invoicing.</Text> : <Text style={styles.text}>GST {line.gstPercent}%: ₹{line.gst} · Discount ₹{line.discount}</Text>}
        <Text style={styles.heading}>Line total ₹{line.total}</Text>
      </View>)}
    </View>)}
    {value.freight ? <View style={styles.line}>
      <Text style={styles.heading}>Freight · {entityName(value.freight.entity)}</Text>
      <Text style={styles.text}>₹{value.freight.amount} + GST {value.freight.gstPercent}% ₹{value.freight.gst}</Text>
      <Text style={styles.text}>{value.freight.recordedQuintals} quintals · {value.freight.recordedKilometres} km (recorded context)</Text>
    </View> : <Text style={styles.text}>Freight awaiting manager confirmation</Text>}
    {value.entities.map((e:any)=><Text key={e.entity} style={styles.text}>{entityName(e.entity)}: ₹{e.total}</Text>)}
    <Text style={styles.heading}>Grand total ₹{value.total}</Text>
  </View>;
}
const styles=StyleSheet.create({
 panel:{padding:16,gap:10,backgroundColor:colors.surface,borderRadius:16},
 group:{gap:4},
 entity:{color:colors.ink,fontSize:15,fontWeight:"700",paddingTop:4},
 line:{paddingVertical:12,gap:6,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},
 routing:{padding:10,gap:4,backgroundColor:colors.canvas,borderRadius:10},
 heading:{color:colors.ink,fontSize:16,fontWeight:"600"},
 text:{color:colors.inkMuted,fontSize:14,lineHeight:21},
});
