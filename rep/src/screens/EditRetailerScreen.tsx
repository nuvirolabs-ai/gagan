import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { repApi } from "../api/repClient";
import { useRep } from "../context/RepContext";
import { RetailerForm, type RetailerFormValues, type RetailerMasters } from "./retailerForm/RetailerForm";
import { ocean } from "./retailerForm/ocean";

export default function EditRetailerScreen({ route, navigation }: any) {
  const { retailerId } = route.params;
  const { rep } = useRep();
  const [masters, setMasters] = useState<RetailerMasters | null>(null);
  const [initialValues, setInitialValues] = useState<Partial<RetailerFormValues> | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(useCallback(() => {
    Promise.all([repApi.retailerMasters(), repApi.retailer(retailerId)])
      .then(([masterData, detail]) => {
        setMasters(masterData);
        const retailer = detail.retailer;
        setInitialValues({
          partyName: retailer.name ?? "",
          groupId: retailer.groupId ?? retailer.group?.id ?? "",
          contactPerson: retailer.contactPerson ?? "",
          mobile: retailer.phone ?? "",
          telephone: retailer.telephone ?? "",
          transporterId: retailer.transporterId ?? retailer.transporter?.id ?? "",
          address1: retailer.shopAddress ?? "",
          pin: retailer.pin ?? "",
          tehsil: retailer.tehsil ?? "",
          district: retailer.district ?? "",
          state: retailer.state ?? "",
          deliveryCity: retailer.deliveryCity ?? "",
          salesmanRepId: retailer.salesmanRepId ?? retailer.salesman?.id ?? rep?.id ?? "",
          beatId: retailer.beatId ?? retailer.beat?.id ?? "",
          shopTenureYears: retailer.shopTenureYears != null ? String(retailer.shopTenureYears) : "",
          gstin: retailer.gstin ?? "",
          aadhaarNumber: retailer.aadhaarNumber ?? "",
          aadhaarPhotoAssetId: retailer.aadhaarPhotoAssetId ?? "",
          paymentTermDays: retailer.paymentTermDays != null ? String(retailer.paymentTermDays) : "15",
          creditLimit: retailer.creditLimit != null ? String(retailer.creditLimit) : "",
          grade: retailer.grade ?? "",
          buyerCategoryId: retailer.buyerCategoryId ?? retailer.buyerCategory?.id ?? "",
          buyerSubCategoryId: retailer.buyerSubCategoryId ?? retailer.buyerSubCategory?.id ?? "",
          upiId: retailer.upiId ?? "",
        });
      })
      .catch(() => setInitialValues(null));
  }, [retailerId, rep?.id]));

  if (!initialValues) {
    return <View style={{ flex: 1, backgroundColor: ocean.navy, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={ocean.sky} /></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: ocean.navy }}>
      <RetailerForm
        mode="edit"
        initialValues={initialValues}
        salesmanRepId={rep?.id ?? initialValues.salesmanRepId ?? ""}
        masters={masters}
        submitting={submitting}
        onUploadAadhaar={async (body) => (await repApi.uploadAadhaar(body)).asset}
        onSubmit={async (payload) => {
          setSubmitting(true);
          try {
            await repApi.updateRetailerProfile(retailerId, { ...payload, salesmanRepId: rep?.id });
            Alert.alert("Retailer updated", "Commercial fields including credit, grade and payment terms were saved.", [
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
