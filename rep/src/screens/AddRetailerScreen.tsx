import React, { useCallback, useState } from "react";
import { Alert, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { repApi } from "../api/repClient";
import { useRep } from "../context/RepContext";
import { RetailerForm, type RetailerMasters } from "./retailerForm/RetailerForm";
import { ocean } from "./retailerForm/ocean";

export default function AddRetailerScreen({ navigation }: any) {
  const { rep } = useRep();
  const [masters, setMasters] = useState<RetailerMasters | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(useCallback(() => {
    repApi.retailerMasters().then(setMasters).catch(() => setMasters({ groups: [], transporters: [], beats: [], buyerCategories: [], salesmen: [], grades: ["A", "B", "C", "D"], paymentTerms: [7, 15, 21, 30, 45] }));
  }, []));

  return (
    <View style={{ flex: 1, backgroundColor: ocean.navy }}>
      <RetailerForm
        mode="add"
        salesmanRepId={rep?.id ?? ""}
        masters={masters}
        submitting={submitting}
        onUploadAadhaar={async (body) => (await repApi.uploadAadhaar(body)).asset}
        onSubmit={async (payload) => {
          setSubmitting(true);
          try {
            await repApi.proposeRetailer({ ...payload, salesmanRepId: payload.salesmanRepId || rep?.id });
            Alert.alert("Proposal submitted", "Ops will review this retailer before it is created.", [
              { text: "OK", onPress: () => navigation.goBack() },
            ]);
          } finally {
            setSubmitting(false);
          }
        }}
      />
    </View>
  );
}
