package com.spendwise;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class AnalyticsControllerTest {
  @Autowired MockMvc mvc;

  @Test void calculatesSavingsRate() throws Exception {
    mvc.perform(post("/api/analytics/savings-rate").contentType(MediaType.APPLICATION_JSON)
      .content("{\"income\":1000,\"expenses\":750}"))
      .andExpect(status().isOk()).andExpect(jsonPath("$.balance").value(250))
      .andExpect(jsonPath("$.savingsRatePercent").value(25.00));
  }

  @Test void flagsBudgetAtEightyPercent() throws Exception {
    mvc.perform(post("/api/analytics/budget-alert?budget=1000")
      .contentType(MediaType.APPLICATION_JSON).content("{\"category\":\"Food\",\"amount\":800}"))
      .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("NEAR_LIMIT"));
  }

  @Test void flagsOverBudget() throws Exception {
    mvc.perform(post("/api/analytics/budget-alert?budget=1000")
      .contentType(MediaType.APPLICATION_JSON).content("{\"category\":\"Food\",\"amount\":1200}"))
      .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("OVER_BUDGET"));
  }

  @Test void rejectsNegativeIncome() throws Exception {
    mvc.perform(post("/api/analytics/savings-rate").contentType(MediaType.APPLICATION_JSON)
      .content("{\"income\":-10,\"expenses\":5}"))
      .andExpect(status().isBadRequest());
  }

  @Test void comparesMonthlyExpenses() throws Exception {
    mvc.perform(post("/api/analytics/compare?previous=1000&current=1200"))
      .andExpect(status().isOk()).andExpect(jsonPath("$.change").value(200))
      .andExpect(jsonPath("$.changePercent").value(20.00));
  }
}
