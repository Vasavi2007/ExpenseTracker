package com.spendwise;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {
  public record Summary(
    @NotNull @DecimalMin(value="0.0", inclusive=true) BigDecimal income,
    @NotNull @DecimalMin(value="0.0", inclusive=true) BigDecimal expenses) {}
  public record CategoryAmount(@NotBlank String category, @NotNull @DecimalMin(value="0.01") BigDecimal amount) {}
  public record Insight(String message, BigDecimal value) {}

  @PostMapping("/savings-rate")
  public Map<String,Object> savingsRate(@Valid @RequestBody Summary summary) {
    BigDecimal balance=summary.income().subtract(summary.expenses());
    BigDecimal rate=summary.income().compareTo(BigDecimal.ZERO)==0
      ? BigDecimal.ZERO
      : balance.multiply(BigDecimal.valueOf(100)).divide(summary.income(),2,RoundingMode.HALF_UP);
    return Map.of("income",summary.income(),"expenses",summary.expenses(),"balance",balance,"savingsRatePercent",rate);
  }

  @PostMapping("/budget-alert")
  public Map<String,Object> budgetAlert(@Valid @RequestBody CategoryAmount amount,
      @RequestParam @DecimalMin("0.01") BigDecimal budget) {
    BigDecimal ratio=amount.amount().divide(budget,4,RoundingMode.HALF_UP);
    String status=ratio.compareTo(BigDecimal.ONE)>=0?"OVER_BUDGET":ratio.compareTo(new BigDecimal("0.80"))>=0?"NEAR_LIMIT":"OK";
    return Map.of("category",amount.category(),"spent",amount.amount(),"budget",budget,"utilizationPercent",ratio.multiply(BigDecimal.valueOf(100)),"status",status);
  }

  @PostMapping("/compare")
  public Map<String,Object> compare(@RequestParam @DecimalMin("0.0") BigDecimal previous,
                                    @RequestParam @DecimalMin("0.0") BigDecimal current) {
    BigDecimal change=current.subtract(previous);
    BigDecimal percent=previous.compareTo(BigDecimal.ZERO)==0?BigDecimal.ZERO:
      change.multiply(BigDecimal.valueOf(100)).divide(previous,2,RoundingMode.HALF_UP);
    return Map.of("previous",previous,"current",current,"change",change,"changePercent",percent);
  }

  @GetMapping("/health")
  public Map<String,String> health() { return Map.of("status","ok","service","spendwise-analytics"); }
}
