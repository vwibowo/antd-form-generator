import type { ScreenSchema } from '../screen';
import { screenSchemaSchema } from '../screen';

/**
 * Reference tour of `dataSource`: every response shape the option mapper
 * handles, plus the cascade, the debounced server search, and the failure
 * state.
 *
 * Unlike the other two presets this one is deliberately eager — opening the
 * Preview fires five requests, because each shape demo has to actually fetch
 * to demonstrate anything. The two expensive paths (the search and the 404)
 * are still user-triggered.
 */
export const remoteDataPreset = {
  key: 'remote-data',
  label: 'Remote data',
  description: 'Every API response shape the option mapper handles, plus cascading, live search, and the error state.',
  create: (): ScreenSchema =>
    screenSchemaSchema.parse({
      title: 'Remote option sources',
      description:
        'Each field below reads a differently shaped JSON response from dummyjson.com. Open the Options panel in the Builder to see how each one is mapped.',
      layout: 'vertical',
      size: 'large',
      gutter: 16,
      submitText: 'Show payload',
      showReset: true,
      nodes: [
        {
          id: 'rd_heading',
          type: 'heading',
          text: 'Response shapes',
          props: { level: 4 },
          extra: 'Four fields, four different JSON layouts, one mapper.',
        },
        {
          // Bare array of objects — no dataPath needed.
          id: 'rd_post_tag',
          type: 'select',
          name: 'postTag',
          label: 'Post tag',
          span: 12,
          placeholder: 'Choose a tag',
          extra: 'Bare array of objects · label "name", value "slug"',
          props: { showSearch: true },
          dataSource: {
            url: 'https://dummyjson.com/posts/tags',
            dataPath: '',
            labelKey: 'name',
            valueKey: 'slug',
          },
        },
        {
          // Bare array of plain strings — labelKey/valueKey are ignored, the
          // mapper turns each string into { label: v, value: v }.
          id: 'rd_recipe_tag',
          type: 'select',
          name: 'recipeTag',
          label: 'Recipe tags',
          span: 12,
          placeholder: 'Choose any number',
          extra: 'Bare array of strings · label and value keys are ignored',
          props: { mode: 'multiple', showSearch: true },
          dataSource: {
            url: 'https://dummyjson.com/recipes/tags',
            dataPath: '',
          },
        },
        {
          // Nested array, numeric values, and a query string that survives
          // template resolution untouched.
          id: 'rd_top_product',
          type: 'radio',
          name: 'topProduct',
          label: 'Top product',
          span: 24,
          extra: 'Nested under "products" · numeric values · remote options on a radio group',
          props: { button: true },
          dataSource: {
            url: 'https://dummyjson.com/products?limit=4&select=title',
            dataPath: 'products',
            labelKey: 'title',
            valueKey: 'id',
          },
        },
        {
          // The label is a dot path two levels into each item.
          id: 'rd_company',
          type: 'checkboxGroup',
          name: 'companyDept',
          label: 'Companies',
          span: 24,
          extra: 'Dot-path label "company.name" · remote options on a checkbox group',
          dataSource: {
            url: 'https://dummyjson.com/users?limit=6&select=company',
            dataPath: 'users',
            labelKey: 'company.name',
            valueKey: 'id',
          },
        },
        { id: 'rd_div_cascade', type: 'divider', label: 'Cascading' },
        {
          id: 'rd_cascade_category',
          type: 'select',
          name: 'cascadeCategory',
          label: 'Category',
          span: 12,
          placeholder: 'Choose a category',
          extra: 'Feeds the field beside it.',
          props: { showSearch: true },
          dataSource: {
            url: 'https://dummyjson.com/products/categories',
            dataPath: '',
            labelKey: 'name',
            valueKey: 'slug',
          },
        },
        {
          // Stays disabled until the category has a value, and clears itself
          // when that value changes.
          id: 'rd_cascade_product',
          type: 'select',
          name: 'cascadeProduct',
          label: 'Products in that category',
          span: 12,
          placeholder: 'Choose any number',
          extra: 'URL contains {{cascadeCategory}}',
          props: { mode: 'multiple', showSearch: true },
          dataSource: {
            url: 'https://dummyjson.com/products/category/{{cascadeCategory}}',
            dataPath: 'products',
            labelKey: 'title',
            valueKey: 'id',
          },
        },
        { id: 'rd_div_search', type: 'divider', label: 'Server-side search' },
        {
          id: 'rd_owner',
          type: 'select',
          name: 'owner',
          label: 'Find a user',
          span: 24,
          placeholder: 'Type at least 2 characters',
          extra: 'One request per settled keystroke, not per keystroke.',
          dataSource: {
            url: 'https://dummyjson.com/users/search',
            dataPath: 'users',
            labelKey: 'email',
            valueKey: 'id',
            search: { param: 'q', debounceMs: 300, minChars: 2 },
          },
        },
        { id: 'rd_div_error', type: 'divider', label: 'Failure state' },
        {
          id: 'rd_error_demo',
          type: 'switch',
          name: 'errorDemo',
          label: 'Load a broken source',
          span: 8,
          defaultValue: false,
        },
        {
          // Condition-gated so the error only appears when asked for.
          id: 'rd_broken',
          type: 'select',
          name: 'brokenSelect',
          label: 'Broken endpoint',
          span: 16,
          placeholder: 'Nothing will load',
          condition: {
            logic: 'and',
            conditions: [{ field: 'errorDemo', operator: 'eq', value: true }],
          },
          dataSource: {
            url: 'https://dummyjson.com/no-such-endpoint',
            dataPath: '',
            labelKey: 'name',
            valueKey: 'id',
          },
        },
      ],
    }),
};
