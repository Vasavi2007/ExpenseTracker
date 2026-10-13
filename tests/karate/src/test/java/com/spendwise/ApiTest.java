package com.spendwise;

import com.intuit.karate.junit5.Karate;

class ApiTest {
  @Karate.Test
  Karate spendwiseApi() {
    return Karate.run("transactions").relativeTo(getClass());
  }
}
