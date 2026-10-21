import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../theme";
import { commercialTaxPresentation, isFreightGstPending, isLineGstPending } from "../lib/commercialTaxPresentation";

export const entityName = (entity:string) => entity === "jain_traders" ? "Jain Traders" : "Padam International";
/** Presentation only: all monetary amounts come from the backend snapshot. */
export default function CommercialBreakdown({value}:{value:any}) {
  if (!value) return null;
  const taxPresentation = commercialTaxPresentation(value);
  const lines: any[] = Array.isArray(value.lines) ? value.lines : [];
  const knownEntities = ["jain_traders", "padam_international"];
  const dynamicEntities = Array.from(new Set(lines.map((line: any) => line.entity).filter(Boolean)));
  const allEntities = Array.from(new Set([...knownEntities, ...dynamicEntities]));
  const grouped = allEntities.map(entity => ({
    entity,
    lines: lines.filter((line: any) => (line.entity || "jain_traders") === entity),
  })).filter(group => group.lines.length > 0);

  const entitiesList: any[] = Array.isArray(value.entities) ? value.entities : [];

  return <View style={styles.panel}>
    <Text style={styles.heading}>Commercial breakdown</Text>
    {taxPresentation.gstLabel ? <Text style={styles.text}>{taxPresentation.gstLabel}</Text> : null}
    {value.routing ? <View style={styles.routing}>
      <Text style={styles.heading}>Routing · {value.routing.destination === "INDORE_CITY" ? "Indore City" : "Outside Indore"}</Text>
      {value.routing.explanation ? <Text style={styles.text}>{value.routing.explanation}</Text> : null}
      {value.routing.eligibleContributionBags != null ? (
        <Text style={styles.text}>Eligible threshold contribution: {value.routing.eligibleContributionBags} bags</Text>
      ) : null}
    </View> : null}
    {grouped.map(group => <View key={group.entity} style={styles.group}>
      <Text style={styles.entity}>{entityName(group.entity)}</Text>
      {group.lines.map((line: any, idx: number)=><View key={line.variantId ?? line.id ?? String(idx)} style={styles.line}>
        <Text style={styles.heading}>{line.productName ?? line.variantId ?? "Product"}</Text>
        {line.pack ? <Text style={styles.text}>{line.pack}</Text> : null}
        <Text style={styles.text}>{line.cases ?? 0} cases · {line.weightKg ?? 0} kg · {line.quintals ?? 0} quintals</Text>
        <Text style={styles.text}>₹{line.rate ?? 0} / {line.rateBasis ?? "case"} · Base ₹{line.base ?? 0}</Text>
        {isLineGstPending(line, value) ? <Text style={styles.text}>{taxPresentation.gstLabel ?? "GST pending — final tax will be applied before invoicing."}</Text> : <Text style={styles.text}>GST {line.gstPercent ?? 0}%: ₹{line.gst ?? 0} · Discount ₹{line.discount ?? 0}</Text>}
        <Text style={styles.heading}>{taxPresentation.pending ? "Pre-tax line total" : "Line total"} ₹{line.total ?? 0}</Text>
      </View>)}
    </View>)}
    {value.freight ? <View style={styles.line}>
      <Text style={styles.heading}>Freight · {entityName(value.freight.entity)}</Text>
      <Text style={styles.text}>{isFreightGstPending(value.freight, value) ? "Freight GST pending — final tax will be applied before invoicing." : `₹${value.freight.amount ?? 0} + GST ${value.freight.gstPercent ?? 0}% ₹${value.freight.gst ?? 0}`}</Text>
      <Text style={styles.text}>{value.freight.recordedQuintals ?? 0} quintals · {value.freight.recordedKilometres ?? 0} km (recorded context)</Text>
    </View> : <Text style={styles.text}>Freight awaiting manager confirmation</Text>}
    {entitiesList.map((e: any)=><Text key={e.entity} style={styles.text}>{entityName(e.entity)}: ₹{e.total ?? 0}</Text>)}
    <Text style={styles.heading}>{taxPresentation.totalLabel} ₹{value.total ?? 0}</Text>
  </View>;
}
const styles=StyleSheet.create({
 panel:{padding:16,gap:10,backgroundColor:colors.surface,borderRadius:16},
 group:{gap:4},
 entity:{color:colors.ink,fontSize:15,fontWeight:"700",paddingTop:4},
 line:{paddingVertical:12,gap:6,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},
 routing:{padding:10,gap:4,backgroundColor:colors.bg,borderRadius:10},
 heading:{color:colors.ink,fontSize:16,fontWeight:"600"},
 text:{color:colors.inkMuted,fontSize:14,lineHeight:21},
});
