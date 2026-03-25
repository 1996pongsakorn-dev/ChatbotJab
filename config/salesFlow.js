export const salesFlow = {
  welcome: {
    question: "สวัสดีค่ะ ยินดีต้อนรับสู่ Toyota AI Sales Agent 🚗",
    next: "budget"
  },
  budget: {
    question: "งบประมาณประมาณเท่าไหร่ครับ?",
    next: "usage"
  },
  usage: {
    question: "ใช้งานหลักในเมืองหรือต่างจังหวัดครับ?",
    next: "seats"
  },
  seats: {
    question: "ต้องการ 5 หรือ 7 ที่นั่งครับ?",
    next: "recommend"
  },
  recommend: {
    action: "recommendCar",
    next: "end"
  }
};