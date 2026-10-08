# Authored v2 native exercise contracts

Requests retain `{exercise_id, code}`. SQL accepts native read-only queries. Excel and Power BI use structured controls with bounded formulas, model rules, report settings and replayable interactions. JSON is internal transport. All modes run inside the isolated task worker; free practice stays in browser Pyodide.

Task-specific variants run on separate modified copies and never change canonical CSVs. The visible answer contract explains those additional checks. These educational simulators do not create `.xlsx` or `.pbix` files or claim full desktop compatibility.

## 93. market-excel-001
Подготовка исходной таблицы
Импорт Orders: 30 строк, 18 полей, заголовки и фильтры; order_date — date, денежные/числовые поля — number, is_new_customer — boolean. Формулы симулятора используют структурированные ссылки Orders.
```json
{
  "solution_spec": {
    "authored_v2": true,
    "operation": "import",
    "delimiter": ",",
    "headers": true,
    "table": "Orders",
    "filters_enabled": true,
    "types": {
      "order_date": "date",
      "quantity": "number",
      "price": "number",
      "discount": "number",
      "revenue": "number",
      "delivery_days": "number",
      "rating": "number",
      "is_new_customer": "boolean"
    }
  },
  "response_spec": {
    "initial": {
      "authored_v2": true,
      "operation": "import",
      "delimiter": "",
      "headers": false,
      "table": "",
      "filters_enabled": false,
      "types": {
        "order_date": "",
        "quantity": "",
        "price": "",
        "discount": "",
        "revenue": "",
        "delivery_days": "",
        "rating": "",
        "is_new_customer": ""
      },
      "interaction_events": []
    },
    "fields": [
      {
        "key": "delimiter",
        "label": "Разделитель",
        "type": "select",
        "default": "",
        "options": [
          ",",
          ";"
        ]
      },
      {
        "key": "headers",
        "label": "Первая строка — заголовки",
        "type": "checkbox",
        "default": false
      },
      {
        "key": "table",
        "label": "Название умной таблицы",
        "type": "text",
        "default": ""
      },
      {
        "key": "filters_enabled",
        "label": "Включить фильтры таблицы",
        "type": "checkbox",
        "default": false
      },
      {
        "key": "types.order_date",
        "label": "Тип поля order_date",
        "type": "select",
        "default": "",
        "options": [
          "date",
          "number",
          "text",
          "boolean"
        ]
      },
      {
        "key": "types.quantity",
        "label": "Тип поля quantity",
        "type": "select",
        "default": "",
        "options": [
          "date",
          "number",
          "text",
          "boolean"
        ]
      },
      {
        "key": "types.price",
        "label": "Тип поля price",
        "type": "select",
        "default": "",
        "options": [
          "date",
          "number",
          "text",
          "boolean"
        ]
      },
      {
        "key": "types.discount",
        "label": "Тип поля discount",
        "type": "select",
        "default": "",
        "options": [
          "date",
          "number",
          "text",
          "boolean"
        ]
      },
      {
        "key": "types.revenue",
        "label": "Тип поля revenue",
        "type": "select",
        "default": "",
        "options": [
          "date",
          "number",
          "text",
          "boolean"
        ]
      },
      {
        "key": "types.delivery_days",
        "label": "Тип поля delivery_days",
        "type": "select",
        "default": "",
        "options": [
          "date",
          "number",
          "text",
          "boolean"
        ]
      },
      {
        "key": "types.rating",
        "label": "Тип поля rating",
        "type": "select",
        "default": "",
        "options": [
          "date",
          "number",
          "text",
          "boolean"
        ]
      },
      {
        "key": "types.is_new_customer",
        "label": "Тип поля is_new_customer",
        "type": "select",
        "default": "",
        "options": [
          "date",
          "number",
          "text",
          "boolean"
        ]
      }
    ]
  },
  "answer_contract": "Импорт Orders: 30 строк, 18 полей, заголовки и фильтры; order_date — date, денежные/числовые поля — number, is_new_customer — boolean. Формулы симулятора используют структурированные ссылки Orders.",
  "documentation_urls": [
    "https://support.microsoft.com/en-us/excel/using-structured-references-with-excel-tables"
  ],
  "validation_spec": {}
}
```

## 94. market-excel-002
Сводная продаж по городам и категориям
Строки city, колонки category, сумма revenue, итоги строк/колонок и общий итог. Незаполненные сочетания показываются нулём.
```json
{
  "solution_spec": {
    "authored_v2": true,
    "operation": "pivot",
    "rows": "city",
    "columns": "category",
    "value": "revenue",
    "aggregate": "sum",
    "totals": true
  },
  "response_spec": {
    "initial": {
      "authored_v2": true,
      "operation": "pivot",
      "rows": "",
      "columns": "",
      "value": "",
      "aggregate": "",
      "totals": false,
      "interaction_events": []
    },
    "fields": [
      {
        "key": "rows",
        "label": "Строки",
        "type": "select",
        "default": "",
        "options": [
          "city",
          "channel",
          "category"
        ]
      },
      {
        "key": "columns",
        "label": "Колонки",
        "type": "select",
        "default": "",
        "options": [
          "city",
          "channel",
          "category"
        ]
      },
      {
        "key": "value",
        "label": "Значения",
        "type": "select",
        "default": "",
        "options": [
          "revenue",
          "price",
          "quantity"
        ]
      },
      {
        "key": "aggregate",
        "label": "Агрегирование",
        "type": "select",
        "default": "",
        "options": [
          "sum",
          "mean",
          "count"
        ]
      },
      {
        "key": "totals",
        "label": "Показывать итоги строк и колонок",
        "type": "checkbox",
        "default": false
      }
    ]
  },
  "answer_contract": "Строки city, колонки category, сумма revenue, итоги строк/колонок и общий итог. Незаполненные сочетания показываются нулём.",
  "documentation_urls": [
    "https://support.microsoft.com/en-us/excel/using-structured-references-with-excel-tables"
  ],
  "validation_spec": {}
}
```

## 95. market-excel-003
Проверка расчёта выручки
Две вычисляемые колонки revenue_calculated и check; проверка использует рассчитанную выручку и возвращает ОК либо Ошибка. Формулы распространяются на все строки; исходные поля не меняются. Дополнительная проверка выполняется на временной копии: цена заказа 1001 изменяется с 7500 до 8500, готовая выручка сохраняется. Расчётная колонка должна пересчитаться, а контроль — отметить расхождение. Канонические CSV при проверке не изменяются.
```json
{
  "solution_spec": {
    "authored_v2": true,
    "operation": "calculated_columns",
    "calculated_columns": {
      "revenue_calculated": "[@quantity]*[@price]-[@discount]",
      "check": "IF([@revenue_calculated]=[@revenue],\"ОК\",\"Ошибка\")"
    }
  },
  "response_spec": {
    "initial": {
      "authored_v2": true,
      "operation": "calculated_columns",
      "calculated_columns": {
        "revenue_calculated": "",
        "check": ""
      },
      "interaction_events": []
    },
    "fields": [
      {
        "key": "calculated_columns.revenue_calculated",
        "label": "Расчётная выручка — формула строки",
        "type": "text",
        "default": ""
      },
      {
        "key": "calculated_columns.check",
        "label": "Проверка — формула IF / ЕСЛИ",
        "type": "text",
        "default": ""
      }
    ]
  },
  "answer_contract": "Две вычисляемые колонки revenue_calculated и check; проверка использует рассчитанную выручку и возвращает ОК либо Ошибка. Формулы распространяются на все строки; исходные поля не меняются. Дополнительная проверка выполняется на временной копии: цена заказа 1001 изменяется с 7500 до 8500, готовая выручка сохраняется. Расчётная колонка должна пересчитаться, а контроль — отметить расхождение. Канонические CSV при проверке не изменяются.",
  "documentation_urls": [
    "https://support.microsoft.com/en-us/excel/using-structured-references-with-excel-tables"
  ],
  "validation_spec": {
    "variants": [
      {
        "name": "Изменённая цена для проверки расчёта",
        "table": "orders",
        "row_updates": [
          {
            "where": {
              "order_id": 1001
            },
            "set": {
              "price": 8500
            }
          }
        ]
      }
    ]
  }
}
```

## 96. market-excel-004
Выделение отменённых заказов
Правило =$N2="Отменён" фиксирует колонку статуса, но не строку. Светло-красное форматирование применяется ко всей строке.
```json
{
  "solution_spec": {
    "authored_v2": true,
    "operation": "format",
    "formula": "=$N2=\"Отменён\"",
    "scope": "rows",
    "style": "light-red"
  },
  "response_spec": {
    "initial": {
      "authored_v2": true,
      "operation": "format",
      "formula": "",
      "scope": "",
      "style": "",
      "interaction_events": []
    },
    "fields": [
      {
        "key": "formula",
        "label": "Формула правила",
        "type": "text",
        "default": ""
      },
      {
        "key": "scope",
        "label": "Область форматирования",
        "type": "select",
        "default": "",
        "options": [
          "rows",
          "cells"
        ]
      },
      {
        "key": "style",
        "label": "Цвет",
        "type": "select",
        "default": "",
        "options": [
          "light-red",
          "light-green",
          "none"
        ]
      }
    ]
  },
  "answer_contract": "Правило =$N2=\"Отменён\" фиксирует колонку статуса, но не строку. Светло-красное форматирование применяется ко всей строке.",
  "documentation_urls": [
    "https://support.microsoft.com/en-us/excel/using-structured-references-with-excel-tables"
  ],
  "validation_spec": {}
}
```

## 97. market-excel-005
Лист руководителя
Пять именованных KPI revenue, orders, average, cancelled, rating. Общая выручка и средний чек — денежный формат. Средняя оценка пропускает пустые ячейки; числа показываются с двумя знаками. Дополнительная проверка выполняется на временной копии с повторением первой строки заказа: KPI должны пересчитываться по строкам таблицы, а не содержать записанные числа. Канонические CSV при проверке не изменяются.
```json
{
  "solution_spec": {
    "authored_v2": true,
    "operation": "kpis",
    "measures": {
      "revenue": "SUM(Orders[revenue])",
      "orders": "COUNTA(Orders[order_id])",
      "average": "[revenue]/[orders]",
      "cancelled": "COUNTIF(Orders[status],\"Отменён\")",
      "rating": "AVERAGE(Orders[rating])"
    },
    "formats": {
      "revenue": "currency",
      "orders": "number",
      "average": "currency",
      "cancelled": "number",
      "rating": "number"
    },
    "layout": "kpi-cards"
  },
  "response_spec": {
    "initial": {
      "authored_v2": true,
      "operation": "kpis",
      "measures": {
        "revenue": "",
        "orders": "",
        "average": "",
        "cancelled": "",
        "rating": ""
      },
      "formats": {
        "revenue": "",
        "orders": "",
        "average": "",
        "cancelled": "",
        "rating": ""
      },
      "layout": "",
      "interaction_events": []
    },
    "fields": [
      {
        "key": "measures.revenue",
        "label": "Выручка",
        "type": "text",
        "default": ""
      },
      {
        "key": "measures.orders",
        "label": "Количество заказов",
        "type": "text",
        "default": ""
      },
      {
        "key": "measures.average",
        "label": "Средний чек",
        "type": "text",
        "default": ""
      },
      {
        "key": "measures.cancelled",
        "label": "Количество отмен",
        "type": "text",
        "default": ""
      },
      {
        "key": "measures.rating",
        "label": "Средняя оценка",
        "type": "text",
        "default": ""
      },
      {
        "key": "formats.revenue",
        "label": "Формат: revenue",
        "type": "select",
        "default": "",
        "options": [
          "number",
          "currency",
          "percent"
        ]
      },
      {
        "key": "formats.orders",
        "label": "Формат: orders",
        "type": "select",
        "default": "",
        "options": [
          "number",
          "currency",
          "percent"
        ]
      },
      {
        "key": "formats.average",
        "label": "Формат: average",
        "type": "select",
        "default": "",
        "options": [
          "number",
          "currency",
          "percent"
        ]
      },
      {
        "key": "formats.cancelled",
        "label": "Формат: cancelled",
        "type": "select",
        "default": "",
        "options": [
          "number",
          "currency",
          "percent"
        ]
      },
      {
        "key": "formats.rating",
        "label": "Формат: rating",
        "type": "select",
        "default": "",
        "options": [
          "number",
          "currency",
          "percent"
        ]
      },
      {
        "key": "layout",
        "label": "Расположение",
        "type": "select",
        "default": "",
        "options": [
          "kpi-cards",
          "table"
        ]
      }
    ]
  },
  "answer_contract": "Пять именованных KPI revenue, orders, average, cancelled, rating. Общая выручка и средний чек — денежный формат. Средняя оценка пропускает пустые ячейки; числа показываются с двумя знаками. Дополнительная проверка выполняется на временной копии с повторением первой строки заказа: KPI должны пересчитываться по строкам таблицы, а не содержать записанные числа. Канонические CSV при проверке не изменяются.",
  "documentation_urls": [
    "https://support.microsoft.com/en-us/excel/using-structured-references-with-excel-tables"
  ],
  "validation_spec": {
    "variants": [
      {
        "name": "Дополнительная строка для пересчёта KPI",
        "table": "orders",
        "append_rows": [
          0
        ]
      }
    ]
  }
}
```

## 98. market-excel-006
Управляемый фильтр отчёта
Срезы city и channel одновременно фильтруют показатели и диаграммы; выберите Москву и Приложение, затем очистите выбор. Выбор не меняет определение мер.
```json
{
  "solution_spec": {
    "authored_v2": true,
    "operation": "report",
    "page": "pivot",
    "measures": {
      "revenue": "SUM(Orders[revenue])",
      "orders": "COUNTA(Orders[order_id])",
      "average": "[revenue]/[orders]"
    },
    "formats": {
      "revenue": "currency",
      "orders": "number",
      "average": "currency"
    },
    "slicers": [
      "city",
      "channel"
    ],
    "interactions": {
      "cards": "filter",
      "city": "filter",
      "category": "filter",
      "channel": "filter"
    },
    "filters": {},
    "selection": null,
    "interaction": "filter",
    "layout": "kpi-structure-time",
    "interaction_events": [
      {
        "type": "filter",
        "field": "city",
        "values": [
          "Москва"
        ]
      },
      {
        "type": "filter",
        "field": "channel",
        "values": [
          "Приложение"
        ]
      },
      {
        "type": "clear"
      }
    ],
    "visual_fields": []
  },
  "response_spec": {
    "initial": {
      "authored_v2": true,
      "operation": "report",
      "page": "pivot",
      "measures": {
        "revenue": "SUM(Orders[revenue])",
        "orders": "COUNTA(Orders[order_id])",
        "average": "[revenue]/[orders]"
      },
      "formats": {
        "revenue": "currency",
        "orders": "number",
        "average": "currency"
      },
      "slicers": [],
      "interactions": {
        "cards": "",
        "city": "",
        "category": "",
        "channel": ""
      },
      "filters": {},
      "selection": null,
      "interaction": "filter",
      "layout": "kpi-structure-time",
      "interaction_events": [],
      "visual_fields": []
    },
    "fields": [
      {
        "key": "slicers",
        "label": "Поля срезов",
        "type": "multiselect",
        "default": [],
        "options": [
          "city",
          "channel",
          "status",
          "category"
        ]
      },
      {
        "key": "interactions.cards",
        "label": "Срез влияет на cards",
        "type": "select",
        "default": "",
        "options": [
          "filter",
          "none"
        ]
      },
      {
        "key": "interactions.city",
        "label": "Срез влияет на city",
        "type": "select",
        "default": "",
        "options": [
          "filter",
          "none"
        ]
      },
      {
        "key": "interactions.category",
        "label": "Срез влияет на category",
        "type": "select",
        "default": "",
        "options": [
          "filter",
          "none"
        ]
      },
      {
        "key": "interactions.channel",
        "label": "Срез влияет на channel",
        "type": "select",
        "default": "",
        "options": [
          "filter",
          "none"
        ]
      }
    ]
  },
  "answer_contract": "Срезы city и channel одновременно фильтруют показатели и диаграммы; выберите Москву и Приложение, затем очистите выбор. Выбор не меняет определение мер.",
  "documentation_urls": [
    "https://support.microsoft.com/en-us/excel/using-structured-references-with-excel-tables"
  ],
  "validation_spec": {
    "interactive": true,
    "required_interactions": {
      "filter_fields": [
        "city",
        "channel"
      ],
      "clear": true,
      "mode": "excel",
      "filter_values": {
        "city": [
          "Москва"
        ],
        "channel": [
          "Приложение"
        ]
      }
    }
  }
}
```

## 99. market-excel-007
Средний чек по каналу
Три строки справочника channel. $A2 означает канал текущей строки. Поддерживаются COUNTIF, SUMIF, IF и именованные ссылки на показатели; средний чек защищён от деления на ноль.
```json
{
  "solution_spec": {
    "authored_v2": true,
    "operation": "formula_table",
    "group_by": "channel",
    "measures": {
      "orders": "COUNTIF(Orders[channel],$A2)",
      "revenue": "SUMIF(Orders[channel],$A2,Orders[revenue])",
      "average": "IF([orders]=0,0,[revenue]/[orders])"
    },
    "formats": {
      "revenue": "currency",
      "orders": "number",
      "average": "currency"
    }
  },
  "response_spec": {
    "initial": {
      "authored_v2": true,
      "operation": "formula_table",
      "group_by": "",
      "measures": {
        "orders": "",
        "revenue": "",
        "average": ""
      },
      "formats": {
        "revenue": "",
        "orders": "",
        "average": ""
      },
      "interaction_events": []
    },
    "fields": [
      {
        "key": "group_by",
        "label": "Строки справочника",
        "type": "select",
        "default": "",
        "options": [
          "channel",
          "city"
        ]
      },
      {
        "key": "measures.orders",
        "label": "Количество заказов",
        "type": "text",
        "default": ""
      },
      {
        "key": "measures.revenue",
        "label": "Выручка",
        "type": "text",
        "default": ""
      },
      {
        "key": "measures.average",
        "label": "Средний чек",
        "type": "text",
        "default": ""
      },
      {
        "key": "formats.revenue",
        "label": "Формат: revenue",
        "type": "select",
        "default": "",
        "options": [
          "number",
          "currency",
          "percent"
        ]
      },
      {
        "key": "formats.orders",
        "label": "Формат: orders",
        "type": "select",
        "default": "",
        "options": [
          "number",
          "currency",
          "percent"
        ]
      },
      {
        "key": "formats.average",
        "label": "Формат: average",
        "type": "select",
        "default": "",
        "options": [
          "number",
          "currency",
          "percent"
        ]
      }
    ]
  },
  "answer_contract": "Три строки справочника channel. $A2 означает канал текущей строки. Поддерживаются COUNTIF, SUMIF, IF и именованные ссылки на показатели; средний чек защищён от деления на ноль.",
  "documentation_urls": [
    "https://support.microsoft.com/en-us/excel/using-structured-references-with-excel-tables"
  ],
  "validation_spec": {}
}
```

## 100. market-excel-008
Поиск ошибок и пропусков
Четыре проверки missing_rating, missing_order_id, negative_revenue, duplicate_order_id. COUNTIF может сравнивать с колонкой и возвращать построчный счётчик. Дубликаты — число строк с повторяющимся номером; пустая оценка допустима, остальные проблемы требуют правки.
```json
{
  "solution_spec": {
    "authored_v2": true,
    "operation": "quality_checks",
    "checks": {
      "missing_rating": "COUNTBLANK(Orders[rating])",
      "missing_order_id": "COUNTBLANK(Orders[order_id])",
      "negative_revenue": "COUNTIF(Orders[revenue],\"<0\")",
      "duplicate_order_id": "SUM(IF(COUNTIF(Orders[order_id],Orders[order_id])>1,1,0))"
    }
  },
  "response_spec": {
    "initial": {
      "authored_v2": true,
      "operation": "quality_checks",
      "checks": {
        "missing_rating": "",
        "missing_order_id": "",
        "negative_revenue": "",
        "duplicate_order_id": ""
      },
      "interaction_events": []
    },
    "fields": [
      {
        "key": "checks.missing_rating",
        "label": "Формула проверки missing_rating",
        "type": "text",
        "default": ""
      },
      {
        "key": "checks.missing_order_id",
        "label": "Формула проверки missing_order_id",
        "type": "text",
        "default": ""
      },
      {
        "key": "checks.negative_revenue",
        "label": "Формула проверки negative_revenue",
        "type": "text",
        "default": ""
      },
      {
        "key": "checks.duplicate_order_id",
        "label": "Формула проверки duplicate_order_id",
        "type": "text",
        "default": ""
      }
    ]
  },
  "answer_contract": "Четыре проверки missing_rating, missing_order_id, negative_revenue, duplicate_order_id. COUNTIF может сравнивать с колонкой и возвращать построчный счётчик. Дубликаты — число строк с повторяющимся номером; пустая оценка допустима, остальные проблемы требуют правки.",
  "documentation_urls": [
    "https://support.microsoft.com/en-us/excel/using-structured-references-with-excel-tables",
    "https://support.microsoft.com/en-us/excel/get-started/use-the-countif-function-in-microsoft-excel"
  ],
  "validation_spec": {}
}
```

## 101. market-excel-009
График динамики продаж
Дневные суммы выручки, даты по возрастанию, линия, денежная ось. Введите содержательный заголовок; его формулировка может отличаться от примера.
```json
{
  "solution_spec": {
    "authored_v2": true,
    "operation": "line",
    "date_field": "order_date",
    "period": "day",
    "measure": "SUM(Orders[revenue])",
    "visual": "line",
    "title": "Дневная выручка KODA Market",
    "format": "currency",
    "sort": "ascending"
  },
  "response_spec": {
    "initial": {
      "authored_v2": true,
      "operation": "line",
      "date_field": "",
      "period": "",
      "measure": "",
      "visual": "",
      "title": "",
      "format": "",
      "sort": "",
      "interaction_events": []
    },
    "fields": [
      {
        "key": "date_field",
        "label": "Поле даты",
        "type": "select",
        "default": "",
        "options": [
          "order_date",
          "city"
        ]
      },
      {
        "key": "period",
        "label": "Период",
        "type": "select",
        "default": "",
        "options": [
          "day",
          "month"
        ]
      },
      {
        "key": "measure",
        "label": "Формула значения",
        "type": "text",
        "default": ""
      },
      {
        "key": "visual",
        "label": "Визуал",
        "type": "select",
        "default": "",
        "options": [
          "line",
          "bar"
        ]
      },
      {
        "key": "title",
        "label": "Заголовок",
        "type": "text",
        "default": ""
      },
      {
        "key": "format",
        "label": "Формат оси",
        "type": "select",
        "default": "",
        "options": [
          "currency",
          "number"
        ]
      },
      {
        "key": "sort",
        "label": "Порядок дат",
        "type": "select",
        "default": "",
        "options": [
          "ascending",
          "descending"
        ]
      }
    ]
  },
  "answer_contract": "Дневные суммы выручки, даты по возрастанию, линия, денежная ось. Введите содержательный заголовок; его формулировка может отличаться от примера.",
  "documentation_urls": [
    "https://support.microsoft.com/en-us/excel/using-structured-references-with-excel-tables"
  ],
  "validation_spec": {
    "ignore_plot_title": true
  }
}
```

## 102. market-excel-010
Вывод для письма руководителю
Три тезиса в свободной формулировке: revenue_orders (385000 и 30), top_city (Волгоград и 169000), cancellation_channel (Магазин и 14,3%). Каждый содержит проверяемый факт; предположение о причине отмечается как гипотеза.
```json
{
  "solution_spec": {
    "authored_v2": true,
    "operation": "memo",
    "statements": [
      {
        "metric": "revenue_orders",
        "text": "Выручка магазина — 385000 рублей, получено 30 заказов."
      },
      {
        "metric": "top_city",
        "text": "Волгоград лидирует: 169000 рублей выручки."
      },
      {
        "metric": "cancellation_channel",
        "text": "В канале Магазин доля отмен — 14,3%; нужно проверить причины отмен."
      }
    ]
  },
  "response_spec": {
    "initial": {
      "authored_v2": true,
      "operation": "memo",
      "statements": [
        {
          "metric": "revenue_orders",
          "text": ""
        },
        {
          "metric": "top_city",
          "text": ""
        },
        {
          "metric": "cancellation_channel",
          "text": ""
        }
      ],
      "interaction_events": []
    },
    "fields": [
      {
        "key": "statements.0.text",
        "label": "Общий результат",
        "type": "textarea",
        "default": ""
      },
      {
        "key": "statements.1.text",
        "label": "Вывод: top_city",
        "type": "textarea",
        "default": ""
      },
      {
        "key": "statements.2.text",
        "label": "Вывод: cancellation_channel",
        "type": "textarea",
        "default": ""
      }
    ]
  },
  "answer_contract": "Три тезиса в свободной формулировке: revenue_orders (385000 и 30), top_city (Волгоград и 169000), cancellation_channel (Магазин и 14,3%). Каждый содержит проверяемый факт; предположение о причине отмечается как гипотеза.",
  "documentation_urls": [
    "https://support.microsoft.com/en-us/excel/using-structured-references-with-excel-tables"
  ],
  "validation_spec": {
    "memo_evidence": true
  }
}
```

## 103. market-power-bi-001
Загрузка и проверка данных
Загрузите orders, customers, products, managers; распознайте заголовки и выбранные типы полей. Симулятор проверяет реальные CSV: 30/22/15/3 строки, orders — 18 полей.
```json
{
  "solution_spec": {
    "authored_v2": true,
    "operation": "model",
    "model": {
      "tables": {
        "orders": {
          "headers": true,
          "types": {
            "order_date": "date",
            "quantity": "number",
            "price": "number",
            "discount": "number",
            "revenue": "number",
            "delivery_days": "number",
            "rating": "number",
            "is_new_customer": "boolean"
          }
        },
        "customers": {
          "headers": true,
          "types": {
            "customer_id": "text",
            "customer_name": "text"
          }
        },
        "products": {
          "headers": true,
          "types": {
            "product": "text",
            "cost_price": "number"
          }
        },
        "managers": {
          "headers": true,
          "types": {
            "manager": "text",
            "experience_years": "number"
          }
        }
      }
    }
  },
  "response_spec": {
    "initial": {
      "authored_v2": true,
      "operation": "model",
      "model": {
        "tables": {
          "orders": {
            "headers": false,
            "types": {
              "order_date": "",
              "quantity": "",
              "price": "",
              "discount": "",
              "revenue": "",
              "delivery_days": "",
              "rating": "",
              "is_new_customer": ""
            }
          },
          "customers": {
            "headers": false,
            "types": {
              "customer_id": "",
              "customer_name": ""
            }
          },
          "products": {
            "headers": false,
            "types": {
              "product": "",
              "cost_price": ""
            }
          },
          "managers": {
            "headers": false,
            "types": {
              "manager": "",
              "experience_years": ""
            }
          }
        }
      },
      "interaction_events": []
    },
    "fields": [
      {
        "key": "model.tables.orders.headers",
        "label": "Заголовки orders",
        "type": "checkbox",
        "default": false
      },
      {
        "key": "model.tables.orders.types.order_date",
        "label": "Тип orders.order_date",
        "type": "select",
        "default": "",
        "options": [
          "date",
          "number",
          "text",
          "boolean"
        ]
      },
      {
        "key": "model.tables.orders.types.quantity",
        "label": "Тип orders.quantity",
        "type": "select",
        "default": "",
        "options": [
          "date",
          "number",
          "text",
          "boolean"
        ]
      },
      {
        "key": "model.tables.orders.types.price",
        "label": "Тип orders.price",
        "type": "select",
        "default": "",
        "options": [
          "date",
          "number",
          "text",
          "boolean"
        ]
      },
      {
        "key": "model.tables.orders.types.discount",
        "label": "Тип orders.discount",
        "type": "select",
        "default": "",
        "options": [
          "date",
          "number",
          "text",
          "boolean"
        ]
      },
      {
        "key": "model.tables.orders.types.revenue",
        "label": "Тип orders.revenue",
        "type": "select",
        "default": "",
        "options": [
          "date",
          "number",
          "text",
          "boolean"
        ]
      },
      {
        "key": "model.tables.orders.types.delivery_days",
        "label": "Тип orders.delivery_days",
        "type": "select",
        "default": "",
        "options": [
          "date",
          "number",
          "text",
          "boolean"
        ]
      },
      {
        "key": "model.tables.orders.types.rating",
        "label": "Тип orders.rating",
        "type": "select",
        "default": "",
        "options": [
          "date",
          "number",
          "text",
          "boolean"
        ]
      },
      {
        "key": "model.tables.orders.types.is_new_customer",
        "label": "Тип orders.is_new_customer",
        "type": "select",
        "default": "",
        "options": [
          "date",
          "number",
          "text",
          "boolean"
        ]
      },
      {
        "key": "model.tables.customers.headers",
        "label": "Заголовки customers",
        "type": "checkbox",
        "default": false
      },
      {
        "key": "model.tables.customers.types.customer_id",
        "label": "Тип customers.customer_id",
        "type": "select",
        "default": "",
        "options": [
          "date",
          "number",
          "text",
          "boolean"
        ]
      },
      {
        "key": "model.tables.customers.types.customer_name",
        "label": "Тип customers.customer_name",
        "type": "select",
        "default": "",
        "options": [
          "date",
          "number",
          "text",
          "boolean"
        ]
      },
      {
        "key": "model.tables.products.headers",
        "label": "Заголовки products",
        "type": "checkbox",
        "default": false
      },
      {
        "key": "model.tables.products.types.product",
        "label": "Тип products.product",
        "type": "select",
        "default": "",
        "options": [
          "date",
          "number",
          "text",
          "boolean"
        ]
      },
      {
        "key": "model.tables.products.types.cost_price",
        "label": "Тип products.cost_price",
        "type": "select",
        "default": "",
        "options": [
          "date",
          "number",
          "text",
          "boolean"
        ]
      },
      {
        "key": "model.tables.managers.headers",
        "label": "Заголовки managers",
        "type": "checkbox",
        "default": false
      },
      {
        "key": "model.tables.managers.types.manager",
        "label": "Тип managers.manager",
        "type": "select",
        "default": "",
        "options": [
          "date",
          "number",
          "text",
          "boolean"
        ]
      },
      {
        "key": "model.tables.managers.types.experience_years",
        "label": "Тип managers.experience_years",
        "type": "select",
        "default": "",
        "options": [
          "date",
          "number",
          "text",
          "boolean"
        ]
      }
    ]
  },
  "answer_contract": "Загрузите orders, customers, products, managers; распознайте заголовки и выбранные типы полей. Симулятор проверяет реальные CSV: 30/22/15/3 строки, orders — 18 полей.",
  "documentation_urls": [
    "https://learn.microsoft.com/en-us/power-query/data-types",
    "https://learn.microsoft.com/en-us/power-bi/connect-data/desktop-data-sources"
  ],
  "validation_spec": {}
}
```

## 104. market-power-bi-002
Главные показатели магазина
Создайте меры revenue, orders и average; ссылки [revenue]/[orders] используют текущий контекст. Карточки и денежные форматы. DISTINCTCOUNT учитывает уникальные order_id; DIVIDE обрабатывает нулевой знаменатель. Дополнительная проверка выполняется на временной копии с повторением первой строки заказа: выручка учитывает обе строки, DISTINCTCOUNT сохраняет число уникальных заказов, DIVIDE заново рассчитывает средний чек. Канонические CSV при проверке не изменяются.
```json
{
  "solution_spec": {
    "authored_v2": true,
    "operation": "cards",
    "measures": {
      "revenue": "SUM(orders[revenue])",
      "orders": "DISTINCTCOUNT(orders[order_id])",
      "average": "DIVIDE([revenue],[orders])"
    },
    "formats": {
      "revenue": "currency",
      "orders": "number",
      "average": "currency"
    },
    "layout": "kpi-cards"
  },
  "response_spec": {
    "initial": {
      "authored_v2": true,
      "operation": "cards",
      "measures": {
        "revenue": "",
        "orders": "",
        "average": ""
      },
      "formats": {
        "revenue": "",
        "orders": "",
        "average": ""
      },
      "layout": "",
      "interaction_events": []
    },
    "fields": [
      {
        "key": "measures.revenue",
        "label": "Выручка",
        "type": "text",
        "default": ""
      },
      {
        "key": "measures.orders",
        "label": "Количество заказов",
        "type": "text",
        "default": ""
      },
      {
        "key": "measures.average",
        "label": "Средний чек",
        "type": "text",
        "default": ""
      },
      {
        "key": "formats.revenue",
        "label": "Формат: revenue",
        "type": "select",
        "default": "",
        "options": [
          "number",
          "currency",
          "percent"
        ]
      },
      {
        "key": "formats.orders",
        "label": "Формат: orders",
        "type": "select",
        "default": "",
        "options": [
          "number",
          "currency",
          "percent"
        ]
      },
      {
        "key": "formats.average",
        "label": "Формат: average",
        "type": "select",
        "default": "",
        "options": [
          "number",
          "currency",
          "percent"
        ]
      },
      {
        "key": "layout",
        "label": "Визуалы показателей",
        "type": "select",
        "default": "",
        "options": [
          "kpi-cards",
          "table"
        ]
      }
    ]
  },
  "answer_contract": "Создайте меры revenue, orders и average; ссылки [revenue]/[orders] используют текущий контекст. Карточки и денежные форматы. DISTINCTCOUNT учитывает уникальные order_id; DIVIDE обрабатывает нулевой знаменатель. Дополнительная проверка выполняется на временной копии с повторением первой строки заказа: выручка учитывает обе строки, DISTINCTCOUNT сохраняет число уникальных заказов, DIVIDE заново рассчитывает средний чек. Канонические CSV при проверке не изменяются.",
  "documentation_urls": [
    "https://learn.microsoft.com/en-us/dax/sum-function-dax",
    "https://learn.microsoft.com/en-us/dax/distinctcount-function-dax",
    "https://learn.microsoft.com/en-us/dax/divide-function-dax"
  ],
  "validation_spec": {
    "variants": [
      {
        "name": "Повторный номер заказа для DISTINCTCOUNT",
        "table": "orders",
        "append_rows": [
          0
        ]
      }
    ]
  }
}
```

## 105. market-power-bi-003
Продажи по городам
Горизонтальные полосы city, сумма revenue, сортировка по убыванию, подписи значений, нулевая ось и денежный формат. Допустим любой содержательный заголовок.
```json
{
  "solution_spec": {
    "authored_v2": true,
    "operation": "bar",
    "group_by": "city",
    "measure": "SUM(orders[revenue])",
    "visual": "horizontal-bar",
    "sort": "descending",
    "title": "Выручка по городам",
    "labels": true,
    "zero_axis": true,
    "format": "currency"
  },
  "response_spec": {
    "initial": {
      "authored_v2": true,
      "operation": "bar",
      "group_by": "",
      "measure": "",
      "visual": "",
      "sort": "",
      "title": "",
      "labels": false,
      "zero_axis": false,
      "format": "",
      "interaction_events": []
    },
    "fields": [
      {
        "key": "group_by",
        "label": "Категории",
        "type": "select",
        "default": "",
        "options": [
          "city",
          "channel",
          "category"
        ]
      },
      {
        "key": "measure",
        "label": "Мера выручки",
        "type": "text",
        "default": ""
      },
      {
        "key": "visual",
        "label": "Тип диаграммы",
        "type": "select",
        "default": "",
        "options": [
          "horizontal-bar",
          "bar",
          "line"
        ]
      },
      {
        "key": "sort",
        "label": "Сортировка",
        "type": "select",
        "default": "",
        "options": [
          "descending",
          "label"
        ]
      },
      {
        "key": "title",
        "label": "Заголовок",
        "type": "text",
        "default": ""
      },
      {
        "key": "labels",
        "label": "Подписи значений",
        "type": "checkbox",
        "default": false
      },
      {
        "key": "zero_axis",
        "label": "Начало числовой оси — ноль",
        "type": "checkbox",
        "default": false
      },
      {
        "key": "format",
        "label": "Формат",
        "type": "select",
        "default": "",
        "options": [
          "currency",
          "number"
        ]
      }
    ]
  },
  "answer_contract": "Горизонтальные полосы city, сумма revenue, сортировка по убыванию, подписи значений, нулевая ось и денежный формат. Допустим любой содержательный заголовок.",
  "documentation_urls": [
    "https://learn.microsoft.com/en-us/dax/sum-function-dax",
    "https://learn.microsoft.com/en-us/dax/distinctcount-function-dax",
    "https://learn.microsoft.com/en-us/dax/divide-function-dax"
  ],
  "validation_spec": {
    "ignore_plot_title": true
  }
}
```

## 106. market-power-bi-004
Фильтр по каналу продаж
Срез channel влияет на карточки и все диаграммы. Проверьте одиночный и множественный выбор каналов, затем очистку. Проверка пересчитывает фактические данные по действиям. Проверьте каждый канал по отдельности.
```json
{
  "solution_spec": {
    "authored_v2": true,
    "operation": "report",
    "page": "sales",
    "measures": {
      "revenue": "SUM(orders[revenue])",
      "orders": "DISTINCTCOUNT(orders[order_id])",
      "average": "DIVIDE([revenue],[orders])"
    },
    "formats": {
      "revenue": "currency",
      "orders": "number",
      "average": "currency"
    },
    "slicers": [
      "channel"
    ],
    "interactions": {
      "cards": "filter",
      "city": "filter",
      "category": "filter",
      "channel": "filter"
    },
    "filters": {},
    "selection": null,
    "interaction": "filter",
    "layout": "kpi-structure-time",
    "interaction_events": [
      {
        "type": "filter",
        "field": "channel",
        "values": [
          "Магазин"
        ]
      },
      {
        "type": "clear"
      },
      {
        "type": "filter",
        "field": "channel",
        "values": [
          "Приложение"
        ]
      },
      {
        "type": "clear"
      },
      {
        "type": "filter",
        "field": "channel",
        "values": [
          "Сайт"
        ]
      },
      {
        "type": "clear"
      },
      {
        "type": "filter",
        "field": "channel",
        "values": [
          "Сайт",
          "Приложение"
        ]
      },
      {
        "type": "clear"
      }
    ]
  },
  "response_spec": {
    "initial": {
      "authored_v2": true,
      "operation": "report",
      "page": "sales",
      "measures": {
        "revenue": "SUM(orders[revenue])",
        "orders": "DISTINCTCOUNT(orders[order_id])",
        "average": "DIVIDE([revenue],[orders])"
      },
      "formats": {
        "revenue": "currency",
        "orders": "number",
        "average": "currency"
      },
      "slicers": [],
      "interactions": {
        "cards": "",
        "city": "",
        "category": "",
        "channel": ""
      },
      "filters": {},
      "selection": null,
      "interaction": "filter",
      "layout": "kpi-structure-time",
      "interaction_events": []
    },
    "fields": [
      {
        "key": "slicers",
        "label": "Поля срезов",
        "type": "multiselect",
        "default": [],
        "options": [
          "channel",
          "city",
          "status"
        ]
      },
      {
        "key": "interactions.cards",
        "label": "Срез влияет на cards",
        "type": "select",
        "default": "",
        "options": [
          "filter",
          "none"
        ]
      },
      {
        "key": "interactions.city",
        "label": "Срез влияет на city",
        "type": "select",
        "default": "",
        "options": [
          "filter",
          "none"
        ]
      },
      {
        "key": "interactions.category",
        "label": "Срез влияет на category",
        "type": "select",
        "default": "",
        "options": [
          "filter",
          "none"
        ]
      },
      {
        "key": "interactions.channel",
        "label": "Срез влияет на channel",
        "type": "select",
        "default": "",
        "options": [
          "filter",
          "none"
        ]
      }
    ]
  },
  "answer_contract": "Срез channel влияет на карточки и все диаграммы. Проверьте одиночный и множественный выбор каналов, затем очистку. Проверка пересчитывает фактические данные по действиям. Проверьте каждый канал по отдельности.",
  "documentation_urls": [
    "https://learn.microsoft.com/en-us/dax/sum-function-dax",
    "https://learn.microsoft.com/en-us/dax/distinctcount-function-dax",
    "https://learn.microsoft.com/en-us/dax/divide-function-dax"
  ],
  "validation_spec": {
    "interactive": true,
    "required_interactions": {
      "filter_fields": [
        "channel"
      ],
      "multiselect": true,
      "clear": true,
      "all_values": [
        "channel"
      ]
    }
  }
}
```

## 107. market-power-bi-005
Средний чек как мера
Таблица city с мерами orders, revenue, average и общей строкой. average рассчитывается как DIVIDE([revenue],[orders]) заново в каждом контексте, не как среднее округлённых городских средних. Дополнительная проверка выполняется на временной копии с повторением первой строки заказа: выручка и средний чек пересчитываются в городском и общем контексте, количество заказов остаётся уникальным. Канонические CSV при проверке не изменяются.
```json
{
  "solution_spec": {
    "authored_v2": true,
    "operation": "report",
    "page": "table",
    "measures": {
      "revenue": "SUM(orders[revenue])",
      "orders": "DISTINCTCOUNT(orders[order_id])",
      "average": "DIVIDE([revenue],[orders])"
    },
    "formats": {
      "revenue": "currency",
      "orders": "number",
      "average": "currency"
    },
    "slicers": [],
    "interactions": {
      "cards": "filter",
      "city": "filter",
      "category": "filter",
      "channel": "filter"
    },
    "filters": {},
    "selection": null,
    "interaction": "filter",
    "layout": "table-with-total",
    "table_field": "city",
    "visual_fields": []
  },
  "response_spec": {
    "initial": {
      "authored_v2": true,
      "operation": "report",
      "page": "table",
      "measures": {
        "revenue": "",
        "orders": "",
        "average": ""
      },
      "formats": {
        "revenue": "",
        "orders": "",
        "average": ""
      },
      "slicers": [],
      "interactions": {
        "cards": "filter",
        "city": "filter",
        "category": "filter",
        "channel": "filter"
      },
      "filters": {},
      "selection": null,
      "interaction": "filter",
      "layout": "",
      "table_field": "",
      "interaction_events": [],
      "visual_fields": []
    },
    "fields": [
      {
        "key": "measures.revenue",
        "label": "Выручка",
        "type": "text",
        "default": ""
      },
      {
        "key": "measures.orders",
        "label": "Количество заказов",
        "type": "text",
        "default": ""
      },
      {
        "key": "measures.average",
        "label": "Средний чек",
        "type": "text",
        "default": ""
      },
      {
        "key": "formats.revenue",
        "label": "Формат: revenue",
        "type": "select",
        "default": "",
        "options": [
          "number",
          "currency",
          "percent"
        ]
      },
      {
        "key": "formats.orders",
        "label": "Формат: orders",
        "type": "select",
        "default": "",
        "options": [
          "number",
          "currency",
          "percent"
        ]
      },
      {
        "key": "formats.average",
        "label": "Формат: average",
        "type": "select",
        "default": "",
        "options": [
          "number",
          "currency",
          "percent"
        ]
      },
      {
        "key": "table_field",
        "label": "Группировка таблицы",
        "type": "select",
        "default": "",
        "options": [
          "city",
          "channel"
        ]
      },
      {
        "key": "layout",
        "label": "Итоги таблицы",
        "type": "select",
        "default": "",
        "options": [
          "table-with-total",
          "table"
        ]
      }
    ]
  },
  "answer_contract": "Таблица city с мерами orders, revenue, average и общей строкой. average рассчитывается как DIVIDE([revenue],[orders]) заново в каждом контексте, не как среднее округлённых городских средних. Дополнительная проверка выполняется на временной копии с повторением первой строки заказа: выручка и средний чек пересчитываются в городском и общем контексте, количество заказов остаётся уникальным. Канонические CSV при проверке не изменяются.",
  "documentation_urls": [
    "https://learn.microsoft.com/en-us/dax/sum-function-dax",
    "https://learn.microsoft.com/en-us/dax/distinctcount-function-dax",
    "https://learn.microsoft.com/en-us/dax/divide-function-dax"
  ],
  "validation_spec": {
    "variants": [
      {
        "name": "Повторный номер заказа для пересчёта мер",
        "table": "orders",
        "append_rows": [
          0
        ]
      }
    ]
  }
}
```

## 108. market-power-bi-006
Динамика по месяцам
Календарь Calendar[date] покрывает 2026-01-01–2026-02-28 и связан с orders.order_date. revenue, previous_revenue, growth — меры; прошлый месяц вычисляется CALCULATE/DATEADD. В учебном подмножестве отсутствующий предыдущий месяц даёт сумму 0. Февральское изменение — 84200. Дополнительная проверка выполняется на временной копии: январская выручка заказа 1001 меняется с 7500 до 9500. Мера предыдущего месяца и февральское изменение должны автоматически пересчитаться. Канонические CSV при проверке не изменяются.
```json
{
  "solution_spec": {
    "authored_v2": true,
    "operation": "line",
    "date_field": "order_date",
    "period": "month",
    "visual": "line",
    "measures": {
      "revenue": "SUM(orders[revenue])",
      "previous_revenue": "CALCULATE([revenue],DATEADD(Calendar[date],-1,MONTH))",
      "growth": "[revenue]-[previous_revenue]"
    },
    "formats": {
      "revenue": "currency",
      "previous_revenue": "currency",
      "growth": "currency"
    },
    "model": {
      "tables": {
        "orders": {
          "headers": true,
          "types": {
            "order_date": "date",
            "quantity": "number",
            "price": "number",
            "discount": "number",
            "revenue": "number",
            "delivery_days": "number",
            "rating": "number",
            "is_new_customer": "boolean"
          }
        },
        "customers": {
          "headers": true,
          "types": {
            "customer_id": "text",
            "customer_name": "text"
          }
        },
        "products": {
          "headers": true,
          "types": {
            "product": "text",
            "cost_price": "number"
          }
        },
        "managers": {
          "headers": true,
          "types": {
            "manager": "text",
            "experience_years": "number"
          }
        }
      },
      "calendar": {
        "start": "2026-01-01",
        "end": "2026-02-28",
        "date_column": "date",
        "relationship": "orders.order_date"
      }
    },
    "title": "Выручка по месяцам",
    "format": "currency",
    "sort": "ascending"
  },
  "response_spec": {
    "initial": {
      "authored_v2": true,
      "operation": "line",
      "date_field": "order_date",
      "period": "month",
      "visual": "",
      "measures": {
        "revenue": "",
        "previous_revenue": "",
        "growth": ""
      },
      "formats": {
        "revenue": "currency",
        "previous_revenue": "currency",
        "growth": "currency"
      },
      "model": {
        "tables": {
          "orders": {
            "headers": true,
            "types": {
              "order_date": "date",
              "quantity": "number",
              "price": "number",
              "discount": "number",
              "revenue": "number",
              "delivery_days": "number",
              "rating": "number",
              "is_new_customer": "boolean"
            }
          },
          "customers": {
            "headers": true,
            "types": {
              "customer_id": "text",
              "customer_name": "text"
            }
          },
          "products": {
            "headers": true,
            "types": {
              "product": "text",
              "cost_price": "number"
            }
          },
          "managers": {
            "headers": true,
            "types": {
              "manager": "text",
              "experience_years": "number"
            }
          }
        },
        "calendar": {
          "start": "",
          "end": "",
          "date_column": "",
          "relationship": ""
        }
      },
      "title": "",
      "format": "currency",
      "sort": "ascending",
      "interaction_events": []
    },
    "fields": [
      {
        "key": "measures.revenue",
        "label": "Выручка",
        "type": "text",
        "default": ""
      },
      {
        "key": "measures.previous_revenue",
        "label": "Выручка прошлого месяца",
        "type": "text",
        "default": ""
      },
      {
        "key": "measures.growth",
        "label": "Изменение выручки",
        "type": "text",
        "default": ""
      },
      {
        "key": "model.calendar.start",
        "label": "Календарь: start",
        "type": "text",
        "default": ""
      },
      {
        "key": "model.calendar.end",
        "label": "Календарь: end",
        "type": "text",
        "default": ""
      },
      {
        "key": "model.calendar.date_column",
        "label": "Календарь: date_column",
        "type": "text",
        "default": ""
      },
      {
        "key": "model.calendar.relationship",
        "label": "Календарь: relationship",
        "type": "text",
        "default": ""
      },
      {
        "key": "visual",
        "label": "Визуал",
        "type": "select",
        "default": "",
        "options": [
          "line",
          "bar"
        ]
      },
      {
        "key": "title",
        "label": "Заголовок",
        "type": "text",
        "default": ""
      }
    ]
  },
  "answer_contract": "Календарь Calendar[date] покрывает 2026-01-01–2026-02-28 и связан с orders.order_date. revenue, previous_revenue, growth — меры; прошлый месяц вычисляется CALCULATE/DATEADD. В учебном подмножестве отсутствующий предыдущий месяц даёт сумму 0. Февральское изменение — 84200. Дополнительная проверка выполняется на временной копии: январская выручка заказа 1001 меняется с 7500 до 9500. Мера предыдущего месяца и февральское изменение должны автоматически пересчитаться. Канонические CSV при проверке не изменяются.",
  "documentation_urls": [
    "https://learn.microsoft.com/en-us/dax/sum-function-dax",
    "https://learn.microsoft.com/en-us/dax/distinctcount-function-dax",
    "https://learn.microsoft.com/en-us/dax/divide-function-dax",
    "https://learn.microsoft.com/en-us/dax/calculate-function-dax",
    "https://learn.microsoft.com/en-us/dax/dateadd-function-dax"
  ],
  "validation_spec": {
    "ignore_plot_title": true,
    "variants": [
      {
        "name": "Изменённая январская выручка",
        "table": "orders",
        "row_updates": [
          {
            "where": {
              "order_id": 1001
            },
            "set": {
              "revenue": 9500
            }
          }
        ]
      }
    ]
  }
}
```

## 109. market-power-bi-007
Страница качества доставки
Страница delivery: три меры slow_delivery, delivery_average, rating_average; диаграмма среднего срока по channel. Срезы city/category должны менять карточки и диаграмму. Пустые оценки пропускаются; проверьте оба среза и очистку. Дополнительная проверка выполняется на временной копии: доставка заказа 1001 меняется на 5 дней, оценка — на 2. Все три меры должны пересчитаться без записанных итоговых чисел. Канонические CSV при проверке не изменяются.
```json
{
  "solution_spec": {
    "authored_v2": true,
    "operation": "report",
    "page": "delivery",
    "measures": {
      "slow_delivery": "CALCULATE(COUNTROWS(orders),orders[delivery_days]>3)",
      "delivery_average": "AVERAGE(orders[delivery_days])",
      "rating_average": "AVERAGE(orders[rating])"
    },
    "formats": {
      "slow_delivery": "number",
      "delivery_average": "number",
      "rating_average": "number"
    },
    "slicers": [
      "city",
      "category"
    ],
    "interactions": {
      "cards": "filter",
      "city": "filter",
      "category": "filter",
      "channel": "filter"
    },
    "filters": {},
    "selection": null,
    "interaction": "filter",
    "layout": "kpi-structure-time",
    "chart_measure": "AVERAGE(orders[delivery_days])",
    "interaction_events": [
      {
        "type": "filter",
        "field": "city",
        "values": [
          "Москва"
        ]
      },
      {
        "type": "filter",
        "field": "category",
        "values": [
          "Электроника"
        ]
      },
      {
        "type": "clear"
      }
    ]
  },
  "response_spec": {
    "initial": {
      "authored_v2": true,
      "operation": "report",
      "page": "delivery",
      "measures": {
        "slow_delivery": "",
        "delivery_average": "",
        "rating_average": ""
      },
      "formats": {
        "slow_delivery": "number",
        "delivery_average": "number",
        "rating_average": "number"
      },
      "slicers": [],
      "interactions": {
        "cards": "",
        "city": "filter",
        "category": "filter",
        "channel": ""
      },
      "filters": {},
      "selection": null,
      "interaction": "filter",
      "layout": "kpi-structure-time",
      "chart_measure": "AVERAGE(orders[delivery_days])",
      "interaction_events": []
    },
    "fields": [
      {
        "key": "measures.slow_delivery",
        "label": "Доставки дольше трёх дней",
        "type": "text",
        "default": ""
      },
      {
        "key": "measures.delivery_average",
        "label": "Средний срок доставки",
        "type": "text",
        "default": ""
      },
      {
        "key": "measures.rating_average",
        "label": "Средняя оценка",
        "type": "text",
        "default": ""
      },
      {
        "key": "slicers",
        "label": "Срезы страницы",
        "type": "multiselect",
        "default": [],
        "options": [
          "city",
          "category",
          "channel"
        ]
      },
      {
        "key": "interactions.cards",
        "label": "Срезы влияют на карточки",
        "type": "select",
        "default": "",
        "options": [
          "filter",
          "none"
        ]
      },
      {
        "key": "interactions.channel",
        "label": "Срезы влияют на каналы",
        "type": "select",
        "default": "",
        "options": [
          "filter",
          "none"
        ]
      }
    ]
  },
  "answer_contract": "Страница delivery: три меры slow_delivery, delivery_average, rating_average; диаграмма среднего срока по channel. Срезы city/category должны менять карточки и диаграмму. Пустые оценки пропускаются; проверьте оба среза и очистку. Дополнительная проверка выполняется на временной копии: доставка заказа 1001 меняется на 5 дней, оценка — на 2. Все три меры должны пересчитаться без записанных итоговых чисел. Канонические CSV при проверке не изменяются.",
  "documentation_urls": [
    "https://learn.microsoft.com/en-us/dax/sum-function-dax",
    "https://learn.microsoft.com/en-us/dax/distinctcount-function-dax",
    "https://learn.microsoft.com/en-us/dax/divide-function-dax",
    "https://learn.microsoft.com/en-us/dax/calculate-function-dax",
    "https://learn.microsoft.com/en-us/dax/average-function-dax"
  ],
  "validation_spec": {
    "interactive": true,
    "required_interactions": {
      "filter_fields": [
        "city",
        "category"
      ],
      "clear": true
    },
    "variants": [
      {
        "name": "Изменённая доставка и оценка",
        "table": "orders",
        "row_updates": [
          {
            "where": {
              "order_id": 1001
            },
            "set": {
              "delivery_days": 5,
              "rating": 2
            }
          }
        ]
      }
    ]
  }
}
```

## 110. market-power-bi-008
Взаимодействие диаграмм
Выбор city или category фильтрует остальные диаграммы и карточки; повторный клик очищает выбор. Проверьте город Волгоград и любую категорию. KPI после Волгограда — 169000, после очистки — 385000.
```json
{
  "solution_spec": {
    "authored_v2": true,
    "operation": "report",
    "page": "sales",
    "measures": {
      "revenue": "SUM(orders[revenue])",
      "orders": "DISTINCTCOUNT(orders[order_id])",
      "average": "DIVIDE([revenue],[orders])"
    },
    "formats": {
      "revenue": "currency",
      "orders": "number",
      "average": "currency"
    },
    "slicers": [],
    "interactions": {
      "cards": "filter",
      "city": "filter",
      "category": "filter",
      "channel": "filter"
    },
    "filters": {},
    "selection": null,
    "interaction": "filter",
    "layout": "kpi-structure-time",
    "interaction_events": [
      {
        "type": "select",
        "field": "city",
        "value": "Волгоград"
      },
      {
        "type": "select",
        "field": "city",
        "value": "Волгоград"
      },
      {
        "type": "select",
        "field": "category",
        "value": "Электроника"
      },
      {
        "type": "select",
        "field": "category",
        "value": "Электроника"
      }
    ]
  },
  "response_spec": {
    "initial": {
      "authored_v2": true,
      "operation": "report",
      "page": "sales",
      "measures": {
        "revenue": "SUM(orders[revenue])",
        "orders": "DISTINCTCOUNT(orders[order_id])",
        "average": "DIVIDE([revenue],[orders])"
      },
      "formats": {
        "revenue": "currency",
        "orders": "number",
        "average": "currency"
      },
      "slicers": [],
      "interactions": {
        "cards": "",
        "city": "",
        "category": "",
        "channel": ""
      },
      "filters": {},
      "selection": null,
      "interaction": "",
      "layout": "kpi-structure-time",
      "interaction_events": []
    },
    "fields": [
      {
        "key": "interaction",
        "label": "Режим выбора элемента",
        "type": "select",
        "default": "",
        "options": [
          "filter",
          "none"
        ]
      },
      {
        "key": "interactions.cards",
        "label": "Влияние на cards",
        "type": "select",
        "default": "",
        "options": [
          "filter",
          "none",
          "highlight"
        ]
      },
      {
        "key": "interactions.city",
        "label": "Влияние на city",
        "type": "select",
        "default": "",
        "options": [
          "filter",
          "none",
          "highlight"
        ]
      },
      {
        "key": "interactions.category",
        "label": "Влияние на category",
        "type": "select",
        "default": "",
        "options": [
          "filter",
          "none",
          "highlight"
        ]
      },
      {
        "key": "interactions.channel",
        "label": "Влияние на channel",
        "type": "select",
        "default": "",
        "options": [
          "filter",
          "none",
          "highlight"
        ]
      }
    ]
  },
  "answer_contract": "Выбор city или category фильтрует остальные диаграммы и карточки; повторный клик очищает выбор. Проверьте город Волгоград и любую категорию. KPI после Волгограда — 169000, после очистки — 385000.",
  "documentation_urls": [
    "https://learn.microsoft.com/en-us/dax/sum-function-dax",
    "https://learn.microsoft.com/en-us/dax/distinctcount-function-dax",
    "https://learn.microsoft.com/en-us/dax/divide-function-dax"
  ],
  "validation_spec": {
    "interactive": true,
    "required_interactions": {
      "selection_fields": [
        "city",
        "category"
      ],
      "clear": true,
      "selection_values": {
        "city": [
          "Волгоград"
        ]
      }
    }
  }
}
```

## 111. market-power-bi-009
Отмены как отдельный показатель
Меры orders, cancelled, cancel_share. cancelled использует фильтр статуса, cancel_share — доля от 0 до 1 и процентный формат; карточка общей доли и сравнение каналов. Числа формулы не умножайте на 100. Дополнительная проверка выполняется на временной копии: заказ 1001 получает статус Отменён. Число и доля отмен должны пересчитаться по исходному и канальному контексту. Канонические CSV при проверке не изменяются.
```json
{
  "solution_spec": {
    "authored_v2": true,
    "operation": "report",
    "page": "cancellations",
    "measures": {
      "orders": "DISTINCTCOUNT(orders[order_id])",
      "cancelled": "CALCULATE([orders],orders[status]=\"Отменён\")",
      "cancel_share": "DIVIDE([cancelled],[orders],0)"
    },
    "formats": {
      "orders": "number",
      "cancelled": "number",
      "cancel_share": "percent"
    },
    "slicers": [],
    "interactions": {
      "cards": "filter",
      "city": "filter",
      "category": "filter",
      "channel": "filter"
    },
    "filters": {},
    "selection": null,
    "interaction": "filter",
    "layout": "card-and-channel",
    "chart_measure": "[cancel_share]",
    "visual_fields": [
      "channel"
    ],
    "card_measures": [
      "cancel_share"
    ]
  },
  "response_spec": {
    "initial": {
      "authored_v2": true,
      "operation": "report",
      "page": "cancellations",
      "measures": {
        "orders": "",
        "cancelled": "",
        "cancel_share": ""
      },
      "formats": {
        "orders": "",
        "cancelled": "",
        "cancel_share": ""
      },
      "slicers": [],
      "interactions": {
        "cards": "filter",
        "city": "filter",
        "category": "filter",
        "channel": "filter"
      },
      "filters": {},
      "selection": null,
      "interaction": "filter",
      "layout": "card-and-channel",
      "chart_measure": "[cancel_share]",
      "interaction_events": [],
      "visual_fields": [
        "channel"
      ],
      "card_measures": [
        "cancel_share"
      ]
    },
    "fields": [
      {
        "key": "measures.orders",
        "label": "Количество заказов",
        "type": "text",
        "default": ""
      },
      {
        "key": "measures.cancelled",
        "label": "Количество отмен",
        "type": "text",
        "default": ""
      },
      {
        "key": "measures.cancel_share",
        "label": "Доля отмен",
        "type": "text",
        "default": ""
      },
      {
        "key": "formats.orders",
        "label": "Формат: orders",
        "type": "select",
        "default": "",
        "options": [
          "number",
          "currency",
          "percent"
        ]
      },
      {
        "key": "formats.cancelled",
        "label": "Формат: cancelled",
        "type": "select",
        "default": "",
        "options": [
          "number",
          "currency",
          "percent"
        ]
      },
      {
        "key": "formats.cancel_share",
        "label": "Формат: cancel_share",
        "type": "select",
        "default": "",
        "options": [
          "number",
          "currency",
          "percent"
        ]
      }
    ]
  },
  "answer_contract": "Меры orders, cancelled, cancel_share. cancelled использует фильтр статуса, cancel_share — доля от 0 до 1 и процентный формат; карточка общей доли и сравнение каналов. Числа формулы не умножайте на 100. Дополнительная проверка выполняется на временной копии: заказ 1001 получает статус Отменён. Число и доля отмен должны пересчитаться по исходному и канальному контексту. Канонические CSV при проверке не изменяются.",
  "documentation_urls": [
    "https://learn.microsoft.com/en-us/dax/sum-function-dax",
    "https://learn.microsoft.com/en-us/dax/distinctcount-function-dax",
    "https://learn.microsoft.com/en-us/dax/divide-function-dax"
  ],
  "validation_spec": {
    "variants": [
      {
        "name": "Дополнительная отмена",
        "table": "orders",
        "row_updates": [
          {
            "where": {
              "order_id": 1001
            },
            "set": {
              "status": "Отменён"
            }
          }
        ]
      }
    ]
  }
}
```

## 112. market-power-bi-010
Три вывода по дашборду
Три независимых свободно сформулированных тезиса: Волгоград и 169000, рост февраля 84200, Магазин и 14,3% отмен. Каждый факт проверяется расчётом; причина отмечается как предположение.
```json
{
  "solution_spec": {
    "authored_v2": true,
    "operation": "memo",
    "statements": [
      {
        "metric": "top_city",
        "text": "Волгоград лидирует: 169000 рублей выручки."
      },
      {
        "metric": "month_growth",
        "text": "Февраль выше января на 84200 рублей."
      },
      {
        "metric": "cancellation_channel",
        "text": "В канале Магазин доля отмен — 14,3%; нужно проверить причины отмен."
      }
    ]
  },
  "response_spec": {
    "initial": {
      "authored_v2": true,
      "operation": "memo",
      "statements": [
        {
          "metric": "top_city",
          "text": ""
        },
        {
          "metric": "month_growth",
          "text": ""
        },
        {
          "metric": "cancellation_channel",
          "text": ""
        }
      ],
      "interaction_events": []
    },
    "fields": [
      {
        "key": "statements.0.text",
        "label": "Вывод: top_city",
        "type": "textarea",
        "default": ""
      },
      {
        "key": "statements.1.text",
        "label": "Вывод: month_growth",
        "type": "textarea",
        "default": ""
      },
      {
        "key": "statements.2.text",
        "label": "Вывод: cancellation_channel",
        "type": "textarea",
        "default": ""
      }
    ]
  },
  "answer_contract": "Три независимых свободно сформулированных тезиса: Волгоград и 169000, рост февраля 84200, Магазин и 14,3% отмен. Каждый факт проверяется расчётом; причина отмечается как предположение.",
  "documentation_urls": [
    "https://learn.microsoft.com/en-us/dax/sum-function-dax",
    "https://learn.microsoft.com/en-us/dax/distinctcount-function-dax",
    "https://learn.microsoft.com/en-us/dax/divide-function-dax"
  ],
  "validation_spec": {
    "memo_evidence": true
  }
}
```

## 113. market-final-report-001
Единый отчёт о продажах
Единая страница: KPI сверху, город/категория в центре, месячная динамика ниже. Повторно используются именованные меры; срезы channel/status влияют на все элементы. Проверьте оба среза и очистку.
```json
{
  "solution_spec": {
    "authored_v2": true,
    "operation": "report",
    "page": "sales",
    "measures": {
      "revenue": "SUM(orders[revenue])",
      "orders": "DISTINCTCOUNT(orders[order_id])",
      "average": "DIVIDE([revenue],[orders])"
    },
    "formats": {
      "revenue": "currency",
      "orders": "number",
      "average": "currency"
    },
    "slicers": [
      "channel",
      "status"
    ],
    "interactions": {
      "cards": "filter",
      "city": "filter",
      "category": "filter",
      "channel": "filter"
    },
    "filters": {},
    "selection": null,
    "interaction": "filter",
    "layout": "kpi-structure-time",
    "model": {
      "tables": {
        "orders": {
          "headers": true,
          "types": {
            "order_date": "date",
            "quantity": "number",
            "price": "number",
            "discount": "number",
            "revenue": "number",
            "delivery_days": "number",
            "rating": "number",
            "is_new_customer": "boolean"
          }
        },
        "customers": {
          "headers": true,
          "types": {
            "customer_id": "text",
            "customer_name": "text"
          }
        },
        "products": {
          "headers": true,
          "types": {
            "product": "text",
            "cost_price": "number"
          }
        },
        "managers": {
          "headers": true,
          "types": {
            "manager": "text",
            "experience_years": "number"
          }
        }
      },
      "relationships": [
        {
          "from": "orders.customer_id",
          "to": "customers.customer_id",
          "cardinality": "many-to-one",
          "active": true
        },
        {
          "from": "orders.product",
          "to": "products.product",
          "cardinality": "many-to-one",
          "active": true
        },
        {
          "from": "orders.manager",
          "to": "managers.manager",
          "cardinality": "many-to-one",
          "active": true
        }
      ]
    },
    "interaction_events": [
      {
        "type": "filter",
        "field": "channel",
        "values": [
          "Сайт"
        ]
      },
      {
        "type": "filter",
        "field": "status",
        "values": [
          "Оплачен"
        ]
      },
      {
        "type": "clear"
      }
    ],
    "visual_fields": [
      "city",
      "category"
    ]
  },
  "response_spec": {
    "initial": {
      "authored_v2": true,
      "operation": "report",
      "page": "sales",
      "measures": {
        "revenue": "",
        "orders": "",
        "average": ""
      },
      "formats": {
        "revenue": "currency",
        "orders": "number",
        "average": "currency"
      },
      "slicers": [],
      "interactions": {
        "cards": "",
        "city": "",
        "category": "",
        "channel": ""
      },
      "filters": {},
      "selection": null,
      "interaction": "filter",
      "layout": "",
      "model": {
        "tables": {
          "orders": {
            "headers": true,
            "types": {
              "order_date": "date",
              "quantity": "number",
              "price": "number",
              "discount": "number",
              "revenue": "number",
              "delivery_days": "number",
              "rating": "number",
              "is_new_customer": "boolean"
            }
          },
          "customers": {
            "headers": true,
            "types": {
              "customer_id": "text",
              "customer_name": "text"
            }
          },
          "products": {
            "headers": true,
            "types": {
              "product": "text",
              "cost_price": "number"
            }
          },
          "managers": {
            "headers": true,
            "types": {
              "manager": "text",
              "experience_years": "number"
            }
          }
        },
        "relationships": [
          {
            "from": "orders.customer_id",
            "to": "customers.customer_id",
            "cardinality": "many-to-one",
            "active": true
          },
          {
            "from": "orders.product",
            "to": "products.product",
            "cardinality": "many-to-one",
            "active": true
          },
          {
            "from": "orders.manager",
            "to": "managers.manager",
            "cardinality": "many-to-one",
            "active": true
          }
        ]
      },
      "interaction_events": [],
      "visual_fields": [
        "city",
        "category"
      ]
    },
    "fields": [
      {
        "key": "measures.revenue",
        "label": "Выручка",
        "type": "text",
        "default": ""
      },
      {
        "key": "measures.orders",
        "label": "Количество заказов",
        "type": "text",
        "default": ""
      },
      {
        "key": "measures.average",
        "label": "Средний чек",
        "type": "text",
        "default": ""
      },
      {
        "key": "slicers",
        "label": "Срезы итогового отчёта",
        "type": "multiselect",
        "default": [],
        "options": [
          "channel",
          "status",
          "city",
          "category"
        ]
      },
      {
        "key": "layout",
        "label": "Расположение",
        "type": "select",
        "default": "",
        "options": [
          "kpi-structure-time",
          "table"
        ]
      },
      {
        "key": "interactions.cards",
        "label": "Фильтрация cards",
        "type": "select",
        "default": "",
        "options": [
          "filter",
          "none"
        ]
      },
      {
        "key": "interactions.city",
        "label": "Фильтрация city",
        "type": "select",
        "default": "",
        "options": [
          "filter",
          "none"
        ]
      },
      {
        "key": "interactions.category",
        "label": "Фильтрация category",
        "type": "select",
        "default": "",
        "options": [
          "filter",
          "none"
        ]
      },
      {
        "key": "interactions.channel",
        "label": "Фильтрация channel",
        "type": "select",
        "default": "",
        "options": [
          "filter",
          "none"
        ]
      }
    ]
  },
  "answer_contract": "Единая страница: KPI сверху, город/категория в центре, месячная динамика ниже. Повторно используются именованные меры; срезы channel/status влияют на все элементы. Проверьте оба среза и очистку.",
  "documentation_urls": [
    "https://learn.microsoft.com/en-us/dax/sum-function-dax",
    "https://learn.microsoft.com/en-us/dax/distinctcount-function-dax",
    "https://learn.microsoft.com/en-us/dax/divide-function-dax"
  ],
  "validation_spec": {
    "interactive": true,
    "required_interactions": {
      "filter_fields": [
        "channel",
        "status"
      ],
      "clear": true
    }
  }
}
```

## 114. market-final-report-002
Проверка отчёта перед публикацией
Десять проверок: totals, unique_orders, missing_rating, relationships, city_filters, channel_filters, status_filters, clear_filters, city_reconciliation, category_reconciliation. Статус выбирается после просмотра реально рассчитанного свидетельства. Проверки фильтров вычисляют каждый вариант, очистка восстанавливает KPI. Три активные связи many-to-one. Выполните выбор города, канала, статуса и очистку. Поочерёдно проверьте каждый город, канал и статус.
```json
{
  "solution_spec": {
    "authored_v2": true,
    "operation": "checklist",
    "model": {
      "tables": {
        "orders": {
          "headers": true,
          "types": {
            "order_date": "date",
            "quantity": "number",
            "price": "number",
            "discount": "number",
            "revenue": "number",
            "delivery_days": "number",
            "rating": "number",
            "is_new_customer": "boolean"
          }
        },
        "customers": {
          "headers": true,
          "types": {
            "customer_id": "text",
            "customer_name": "text"
          }
        },
        "products": {
          "headers": true,
          "types": {
            "product": "text",
            "cost_price": "number"
          }
        },
        "managers": {
          "headers": true,
          "types": {
            "manager": "text",
            "experience_years": "number"
          }
        }
      },
      "relationships": [
        {
          "from": "orders.customer_id",
          "to": "customers.customer_id",
          "cardinality": "many-to-one",
          "active": true
        },
        {
          "from": "orders.product",
          "to": "products.product",
          "cardinality": "many-to-one",
          "active": true
        },
        {
          "from": "orders.manager",
          "to": "managers.manager",
          "cardinality": "many-to-one",
          "active": true
        }
      ]
    },
    "report": {
      "operation": "report",
      "page": "sales",
      "measures": {
        "revenue": "SUM(orders[revenue])",
        "orders": "DISTINCTCOUNT(orders[order_id])",
        "average": "DIVIDE([revenue],[orders])"
      },
      "formats": {
        "revenue": "currency",
        "orders": "number",
        "average": "currency"
      },
      "slicers": [
        "channel",
        "status"
      ],
      "interactions": {
        "cards": "filter",
        "city": "filter",
        "category": "filter",
        "channel": "filter"
      },
      "filters": {},
      "selection": null,
      "interaction": "filter",
      "layout": "kpi-structure-time",
      "authored_v2": true
    },
    "checks": [
      {
        "id": "totals",
        "status": "пройдено"
      },
      {
        "id": "unique_orders",
        "status": "пройдено"
      },
      {
        "id": "missing_rating",
        "status": "пройдено"
      },
      {
        "id": "relationships",
        "status": "пройдено"
      },
      {
        "id": "city_filters",
        "status": "пройдено"
      },
      {
        "id": "channel_filters",
        "status": "пройдено"
      },
      {
        "id": "status_filters",
        "status": "пройдено"
      },
      {
        "id": "clear_filters",
        "status": "пройдено"
      },
      {
        "id": "city_reconciliation",
        "status": "пройдено"
      },
      {
        "id": "category_reconciliation",
        "status": "пройдено"
      }
    ],
    "interaction_events": [
      {
        "type": "filter",
        "field": "city",
        "values": [
          "Волгоград"
        ]
      },
      {
        "type": "clear"
      },
      {
        "type": "filter",
        "field": "city",
        "values": [
          "Москва"
        ]
      },
      {
        "type": "clear"
      },
      {
        "type": "filter",
        "field": "city",
        "values": [
          "Тула"
        ]
      },
      {
        "type": "clear"
      },
      {
        "type": "filter",
        "field": "channel",
        "values": [
          "Магазин"
        ]
      },
      {
        "type": "clear"
      },
      {
        "type": "filter",
        "field": "channel",
        "values": [
          "Приложение"
        ]
      },
      {
        "type": "clear"
      },
      {
        "type": "filter",
        "field": "channel",
        "values": [
          "Сайт"
        ]
      },
      {
        "type": "clear"
      },
      {
        "type": "filter",
        "field": "status",
        "values": [
          "Оплачен"
        ]
      },
      {
        "type": "clear"
      },
      {
        "type": "filter",
        "field": "status",
        "values": [
          "Отменён"
        ]
      },
      {
        "type": "clear"
      },
      {
        "type": "filter",
        "field": "status",
        "values": [
          "Возврат"
        ]
      },
      {
        "type": "clear"
      }
    ]
  },
  "response_spec": {
    "initial": {
      "authored_v2": true,
      "operation": "checklist",
      "model": {
        "tables": {
          "orders": {
            "headers": true,
            "types": {
              "order_date": "date",
              "quantity": "number",
              "price": "number",
              "discount": "number",
              "revenue": "number",
              "delivery_days": "number",
              "rating": "number",
              "is_new_customer": "boolean"
            }
          },
          "customers": {
            "headers": true,
            "types": {
              "customer_id": "text",
              "customer_name": "text"
            }
          },
          "products": {
            "headers": true,
            "types": {
              "product": "text",
              "cost_price": "number"
            }
          },
          "managers": {
            "headers": true,
            "types": {
              "manager": "text",
              "experience_years": "number"
            }
          }
        },
        "relationships": [
          {
            "from": "orders.customer_id",
            "to": "customers.customer_id",
            "cardinality": "",
            "active": false
          },
          {
            "from": "orders.product",
            "to": "products.product",
            "cardinality": "",
            "active": false
          },
          {
            "from": "orders.manager",
            "to": "managers.manager",
            "cardinality": "",
            "active": false
          }
        ]
      },
      "report": {
        "operation": "report",
        "page": "sales",
        "measures": {
          "revenue": "SUM(orders[revenue])",
          "orders": "DISTINCTCOUNT(orders[order_id])",
          "average": "DIVIDE([revenue],[orders])"
        },
        "formats": {
          "revenue": "currency",
          "orders": "number",
          "average": "currency"
        },
        "slicers": [
          "channel",
          "status"
        ],
        "interactions": {
          "cards": "filter",
          "city": "filter",
          "category": "filter",
          "channel": "filter"
        },
        "filters": {},
        "selection": null,
        "interaction": "filter",
        "layout": "kpi-structure-time",
        "authored_v2": true
      },
      "checks": [
        {
          "id": "totals",
          "status": ""
        },
        {
          "id": "unique_orders",
          "status": ""
        },
        {
          "id": "missing_rating",
          "status": ""
        },
        {
          "id": "relationships",
          "status": ""
        },
        {
          "id": "city_filters",
          "status": ""
        },
        {
          "id": "channel_filters",
          "status": ""
        },
        {
          "id": "status_filters",
          "status": ""
        },
        {
          "id": "clear_filters",
          "status": ""
        },
        {
          "id": "city_reconciliation",
          "status": ""
        },
        {
          "id": "category_reconciliation",
          "status": ""
        }
      ],
      "interaction_events": []
    },
    "fields": [
      {
        "key": "checks.0.status",
        "label": "Результат проверки: totals",
        "type": "select",
        "default": "",
        "options": [
          "пройдено",
          "нужна правка"
        ]
      },
      {
        "key": "checks.1.status",
        "label": "Результат проверки: unique_orders",
        "type": "select",
        "default": "",
        "options": [
          "пройдено",
          "нужна правка"
        ]
      },
      {
        "key": "checks.2.status",
        "label": "Результат проверки: missing_rating",
        "type": "select",
        "default": "",
        "options": [
          "пройдено",
          "нужна правка"
        ]
      },
      {
        "key": "checks.3.status",
        "label": "Результат проверки: relationships",
        "type": "select",
        "default": "",
        "options": [
          "пройдено",
          "нужна правка"
        ]
      },
      {
        "key": "checks.4.status",
        "label": "Результат проверки: city_filters",
        "type": "select",
        "default": "",
        "options": [
          "пройдено",
          "нужна правка"
        ]
      },
      {
        "key": "checks.5.status",
        "label": "Результат проверки: channel_filters",
        "type": "select",
        "default": "",
        "options": [
          "пройдено",
          "нужна правка"
        ]
      },
      {
        "key": "checks.6.status",
        "label": "Результат проверки: status_filters",
        "type": "select",
        "default": "",
        "options": [
          "пройдено",
          "нужна правка"
        ]
      },
      {
        "key": "checks.7.status",
        "label": "Результат проверки: clear_filters",
        "type": "select",
        "default": "",
        "options": [
          "пройдено",
          "нужна правка"
        ]
      },
      {
        "key": "checks.8.status",
        "label": "Результат проверки: city_reconciliation",
        "type": "select",
        "default": "",
        "options": [
          "пройдено",
          "нужна правка"
        ]
      },
      {
        "key": "checks.9.status",
        "label": "Результат проверки: category_reconciliation",
        "type": "select",
        "default": "",
        "options": [
          "пройдено",
          "нужна правка"
        ]
      },
      {
        "key": "model.relationships.0.cardinality",
        "label": "Связь orders.customer_id → customers.customer_id",
        "type": "select",
        "default": "",
        "options": [
          "many-to-one",
          "many-to-many"
        ]
      },
      {
        "key": "model.relationships.0.active",
        "label": "Связь активна",
        "type": "checkbox",
        "default": false
      },
      {
        "key": "model.relationships.1.cardinality",
        "label": "Связь orders.product → products.product",
        "type": "select",
        "default": "",
        "options": [
          "many-to-one",
          "many-to-many"
        ]
      },
      {
        "key": "model.relationships.1.active",
        "label": "Связь активна",
        "type": "checkbox",
        "default": false
      },
      {
        "key": "model.relationships.2.cardinality",
        "label": "Связь orders.manager → managers.manager",
        "type": "select",
        "default": "",
        "options": [
          "many-to-one",
          "many-to-many"
        ]
      },
      {
        "key": "model.relationships.2.active",
        "label": "Связь активна",
        "type": "checkbox",
        "default": false
      }
    ]
  },
  "answer_contract": "Десять проверок: totals, unique_orders, missing_rating, relationships, city_filters, channel_filters, status_filters, clear_filters, city_reconciliation, category_reconciliation. Статус выбирается после просмотра реально рассчитанного свидетельства. Проверки фильтров вычисляют каждый вариант, очистка восстанавливает KPI. Три активные связи many-to-one. Выполните выбор города, канала, статуса и очистку. Поочерёдно проверьте каждый город, канал и статус.",
  "documentation_urls": [
    "https://learn.microsoft.com/en-us/power-bi/transform-model/desktop-relationships-understand"
  ],
  "validation_spec": {
    "interactive": true,
    "required_interactions": {
      "filter_fields": [
        "city",
        "channel",
        "status"
      ],
      "clear": true,
      "all_values": [
        "city",
        "channel",
        "status"
      ]
    }
  }
}
```

## 115. market-final-report-003
Ответ руководителю
Пять коротких пунктов: итог 385000 и 30, рост февраля 84200, Волгоград 169000, Магазин 14,3% отмен, конкретная дополнительная проверка. Текст свободный, факты обязательны; нельзя выдавать предположение о причине за установленный факт.
```json
{
  "solution_spec": {
    "authored_v2": true,
    "operation": "memo",
    "statements": [
      {
        "metric": "revenue_orders",
        "text": "Выручка магазина — 385000 рублей, получено 30 заказов."
      },
      {
        "metric": "month_growth",
        "text": "Февраль выше января на 84200 рублей."
      },
      {
        "metric": "top_city",
        "text": "Волгоград лидирует: 169000 рублей выручки."
      },
      {
        "metric": "cancellation_channel",
        "text": "В канале Магазин доля отмен — 14,3%; нужно проверить причины отмен."
      },
      {
        "metric": "next_action",
        "text": "Нужно проверить отмены в канале Магазин по датам и способу оплаты."
      }
    ]
  },
  "response_spec": {
    "initial": {
      "authored_v2": true,
      "operation": "memo",
      "statements": [
        {
          "metric": "revenue_orders",
          "text": ""
        },
        {
          "metric": "month_growth",
          "text": ""
        },
        {
          "metric": "top_city",
          "text": ""
        },
        {
          "metric": "cancellation_channel",
          "text": ""
        },
        {
          "metric": "next_action",
          "text": ""
        }
      ],
      "interaction_events": []
    },
    "fields": [
      {
        "key": "statements.0.text",
        "label": "Общий результат",
        "type": "textarea",
        "default": ""
      },
      {
        "key": "statements.1.text",
        "label": "Вывод: month_growth",
        "type": "textarea",
        "default": ""
      },
      {
        "key": "statements.2.text",
        "label": "Вывод: top_city",
        "type": "textarea",
        "default": ""
      },
      {
        "key": "statements.3.text",
        "label": "Вывод: cancellation_channel",
        "type": "textarea",
        "default": ""
      },
      {
        "key": "statements.4.text",
        "label": "Вывод: next_action",
        "type": "textarea",
        "default": ""
      }
    ]
  },
  "answer_contract": "Пять коротких пунктов: итог 385000 и 30, рост февраля 84200, Волгоград 169000, Магазин 14,3% отмен, конкретная дополнительная проверка. Текст свободный, факты обязательны; нельзя выдавать предположение о причине за установленный факт.",
  "documentation_urls": [
    "https://learn.microsoft.com/en-us/dax/sum-function-dax",
    "https://learn.microsoft.com/en-us/dax/distinctcount-function-dax",
    "https://learn.microsoft.com/en-us/dax/divide-function-dax"
  ],
  "validation_spec": {
    "memo_evidence": true
  }
}
```
