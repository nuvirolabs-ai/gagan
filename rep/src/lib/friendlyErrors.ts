export interface FriendlyError {
  title: string;
  message: string;
}

type Lang = "en" | "hi" | "mr";

interface ErrorCopy {
  title: string;
  message: string;
}

const ERROR_MAP: Record<string, Record<Lang, ErrorCopy>> = {
  minimum_order_value: {
    en: {
      title: "Minimum Order Required",
      message: "Order value is below the minimum required amount. Please add more items to check out.",
    },
    hi: {
      title: "न्यूनतम ऑर्डर आवश्यक",
      message: "ऑर्डर मूल्य आवश्यक न्यूनतम राशि से कम है। कृपया चेक आउट करने के लिए और सामान जोड़ें।",
    },
    mr: {
      title: "किमान ऑर्डर आवश्यक",
      message: "ऑर्डरचे मूल्य आवश्यक किमान रकमेपेक्षा कमी आहे. कृपया चेक आऊट करण्यासाठी अधिक वस्तू जोडा.",
    },
  },
  insufficient_inventory: {
    en: {
      title: "Item Shortage",
      message: "The requested quantity is currently not available. Please adjust the item quantity.",
    },
    hi: {
      title: "स्टॉक की कमी",
      message: "मांगी गई मात्रा फ़िलहाल उपलब्ध नहीं है। कृपया मात्रा कम करें।",
    },
    mr: {
      title: "स्टॉकची कमतरता",
      message: "मागणी केलेली संख्या सध्या उपलब्ध नाही. कृपया प्रमाण कमी करा.",
    },
  },
  inventory_stale: {
    en: {
      title: "Stock Updating",
      message: "Live stock information is updating. Please try again in a few moments.",
    },
    hi: {
      title: "स्टॉक अपडेट हो रहा है",
      message: "स्टॉक की जानकारी अपडेट हो रही है। कृपया कुछ पलों में पुनः प्रयास करें।",
    },
    mr: {
      title: "स्टॉक अपडेट होत आहे",
      message: "स्टॉकची माहिती अपडेट होत आहे. कृपया काही क्षणात पुन्हा प्रयत्न करा.",
    },
  },
  inventory_unavailable: {
    en: {
      title: "Stock Updating",
      message: "Live stock information is updating. Please try again in a few moments.",
    },
    hi: {
      title: "स्टॉक अपडेट हो रहा है",
      message: "स्टॉक की जानकारी अपडेट हो रही है। कृपया कुछ पलों में पुनः प्रयास करें।",
    },
    mr: {
      title: "स्टॉक अपडेट होत आहे",
      message: "स्टॉकची माहिती अपडेट होत आहे. कृपया काही क्षणात पुन्हा प्रयत्न करा.",
    },
  },
  idempotency_key_conflict: {
    en: {
      title: "Order Already Placed",
      message: "This checkout was already submitted. Please review your order history.",
    },
    hi: {
      title: "ऑर्डर पहले ही दिया जा चुका है",
      message: "यह ऑर्डर पहले ही सबमिट किया जा चुका है। कृपया अपना ऑर्डर इतिहास देखें।",
    },
    mr: {
      title: "ऑर्डर आधीच नोंदवली आहे",
      message: "ही ऑर्डर आधीच सबमिट केली गेली आहे. कृपया आपला ऑर्डर इतिहास तपासा.",
    },
  },
  quote_changed_or_expired: {
    en: {
      title: "Prices Updated",
      message: "Prices or commercial terms were recently updated. Please review the updated cart before submitting.",
    },
    hi: {
      title: "कीमतें अपडेट हुईं",
      message: "कीमतों या डिलीवरी शर्तों में हाल ही में बदलाव हुआ है। कृपया ऑर्डर देने से पहले कार्ट की समीक्षा करें।",
    },
    mr: {
      title: "किमती अपडेट झाल्या",
      message: "किमती किंवा व्यापारी अटींमध्ये बदल झाला आहे. कृपया ऑर्डर देण्यापूर्वी कार्ट तपासा.",
    },
  },
  kyc_required: {
    en: {
      title: "Account Activation Pending",
      message: "Store account verification is in progress. Please contact the sales lead.",
    },
    hi: {
      title: "खाता सक्रियण लंबित",
      message: "स्टोर खाता सत्यापन प्रगति पर है। कृपया सेल्स लीड से संपर्क करें।",
    },
    mr: {
      title: "खाते सक्रियीकरण प्रलंबित",
      message: "दुकान खात्याची पडताळणी सुरू आहे. कृपया विक्री प्रमुखांशी संपर्क साधा.",
    },
  },
  credit_blocked: {
    en: {
      title: "Account Review Required",
      message: "Please clear any outstanding dues or review store credit before ordering.",
    },
    hi: {
      title: "खाता समीक्षा आवश्यक",
      message: "कृपया बकाया राशि का भुगतान करें या ऑर्डर करने से पहले स्टोर क्रेडिट की समीक्षा करें।",
    },
    mr: {
      title: "खाते पुनरावलोकन आवश्यक",
      message: "कृपया थकबाकी भरा किंवा ऑर्डर देण्यापूर्वी स्टोअर क्रेडिट तपासा.",
    },
  },
  invalid_coupon: {
    en: {
      title: "Invalid Coupon",
      message: "The coupon code you entered is invalid. Please check the spelling and try again.",
    },
    hi: {
      title: "अमान्य कूपन",
      message: "आपके द्वारा दर्ज किया गया कूपन कोड अमान्य है। कृपया कोड जांचें और पुनः प्रयास करें।",
    },
    mr: {
      title: "अवैध कूपन",
      message: "आपण प्रविष्ट केलेला कूपन कोड अवैध आहे. कृपया स्पेलिंग तपासा आणि पुन्हा प्रयत्न करा.",
    },
  },
  coupon_min_value_not_met: {
    en: {
      title: "Coupon Minimum Value",
      message: "Your cart subtotal does not meet the minimum amount required for this coupon.",
    },
    hi: {
      title: "कूपन शर्त पूरी नहीं हुई",
      message: "आपका कार्ट मूल्य इस कूपन के लिए आवश्यक न्यूनतम राशि से कम है।",
    },
    mr: {
      title: "किमान कूपन मूल्य",
      message: "आपले कार्ट मूल्य या कूपनसाठी आवश्यक असलेल्या किमान रकमेपेक्षा कमी आहे.",
    },
  },
  rate_limit_exceeded: {
    en: {
      title: "Please Slow Down",
      message: "Too many requests sent in a short time. Please wait a few seconds and try again.",
    },
    hi: {
      title: "कृपया प्रतीक्षा करें",
      message: "कम समय में बहुत अधिक अनुरोध भेजे गए। कृपया कुछ सेकंड प्रतीक्षा करें।",
    },
    mr: {
      title: "कृपया थांबा",
      message: "कमी वेळेत खूप जास्त विनंत्या पाठवल्या गेल्या. कृपया काही सेकंद प्रतीक्षा करा.",
    },
  },
};

const NETWORK_ERROR: Record<Lang, ErrorCopy> = {
  en: {
    title: "Network Connection Issue",
    message: "Weak internet connection. Please check your network and try again.",
  },
  hi: {
    title: "नेटवर्क समस्या",
    message: "कमज़ोर इंटरनेट कनेक्शन। कृपया अपना नेटवर्क जांचें और फिर प्रयास करें।",
  },
  mr: {
    title: "नेटवर्क समस्या",
    message: "कमकुवत इंटरनेट कनेक्शन. कृपया आपले नेटवर्क तपासा आणि पुन्हा प्रयत्न करा.",
  },
};

const GENERIC_ERROR: Record<Lang, ErrorCopy> = {
  en: {
    title: "Notice",
    message: "Something went wrong while processing your request. Please try again.",
  },
  hi: {
    title: "सूचना",
    message: "अनुरोध प्रोसेस करते समय कुछ समस्या आई। कृपया पुनः प्रयास करें।",
  },
  mr: {
    title: "सूचना",
    message: "विनंती प्रक्रिया करताना काही अडचण आली. कृपया पुन्हा प्रयत्न करा.",
  },
};

export function friendlyErrorMessage(error: unknown, language: string = "en"): FriendlyError {
  const lang: Lang = language === "hi" ? "hi" : language === "mr" ? "mr" : "en";

  if (!error) return GENERIC_ERROR[lang];

  // Detect network failures
  if (error instanceof TypeError && /network|fetch|failed/i.test(error.message)) {
    return NETWORK_ERROR[lang];
  }

  // Extract error code from ApiError / SessionFetchError
  const anyErr = error as any;
  const rawCode =
    (typeof anyErr?.body?.error === "string" ? anyErr.body.error : null) ??
    (typeof anyErr?.message === "string" ? anyErr.message : null);

  if (rawCode && /network|fetch|failed to fetch/i.test(rawCode)) {
    return NETWORK_ERROR[lang];
  }

  if (rawCode && ERROR_MAP[rawCode]) {
    return ERROR_MAP[rawCode][lang];
  }

  if (rawCode && rawCode.includes(" ") && !rawCode.includes("_")) {
    return {
      title: GENERIC_ERROR[lang].title,
      message: rawCode,
    };
  }

  return GENERIC_ERROR[lang];
}
