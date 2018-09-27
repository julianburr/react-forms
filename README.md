# @aaronuu/react-forms

**WIP README** - Some features are not documented yet

## Features

Field first form state management - no double handling of state updates within fields and the outer container.

Deals with state management and tricky react form quirks only, leaves the view and layout up to you.

## Getting Started

### Installing

Install using yarn

```
yarn add @aaronuu/react-forms
```

Install using npm

```
npm i @aaronuu/react-forms
```

## Usage

There are two different ways to use `@aaronuu/react-forms`

- `withForm({ name: 'form', ...config })` - a higher order component that will inject the forms state
- `<ReactForms />` - a react component with a render prop (recommended)

`withForm()` is just a light wrapper around `<ReactForms />` that will namespace your form based on the name you give within the configuration object (default is `form`)

There are four different components within `@aaronuu/react-forms`

- `<ReactForms />`
- `<Form />`
- `<Field />`
- `<FieldArray />`

In addition to these there are two different HOC's

- `withForm({ ...config })`
- `withContext`

### ReactForms

This is the state container for the form, it is the place where all `<Field />` state is organised and the submit functionality is implemented. This component gives you the state of the form and access to the form helpers to manipulate that state.

### Props

#### `asyncValuesReady: boolean (true)`

Sometimes you want to render a form before some asynchrounous data that will be used as the initial values of the form has been loaded. When this prop switches from false to true it resets the form and will render again with the new initial values that you have passed in. It is best to not allow users to be able to input into the form until after this prop is true as everything that they have already entered will be lost.

#### `initialValues: { [fieldName]: value }`

The initial values that each field will be given

#### `validateOnChange: boolean (true)`

Whether or not to run validations when the field value changes

#### `validateOnBlur: boolean (true)`

Whether or not to run validations when the field is blurred

#### `validateOnMount: boolean (false)`

Whether or not to run validations when the field is mounted

#### `touchOnChange: boolean (true)`

Whether or not any field is considered to be touched when it's value changes

#### `touchOnBlur: boolean (true)`

Whether or not any field is considered touched when it is blurred

#### `shouldUnregister: boolean (true)`

Whether each field should unregister itself when it's name changes or it is unmounted. Individual fields' `shouldUnregister` property will take precendence over this.

#### `handleSubmit: (values, actions) => Promise|void (noop)`

The function that will run when the form is submitted or when the `submitForm` function is called, and all validations have passed. If this function returns a promise `isSubmitting` will be set to false after that promise has resolved or rejected, otherwise it will be set immediately after it has finished executing.

#### `validate: (values) => Promise|Object`

The function that will be used to validate each field. Can either return a promise or an object

### Form

This is a convenience component that attaches the form's `submitForm` method onto a `<form />`'s `onSubmit` handler.

### Field

This is where most of the work happens, all `<Field />` components are self contained state managers in their own right and will only pass their state up to the parent `onBlur` (or `onChange` if the `sendImmediate` prop is set to true). These `<Field />`'s should be considered to be the source of truth for their own slice of the form state.

Each `<Field />` is registered with it's closest form container on mount and by default is unregistered when unmounting (changed by the `shouldUnregister` prop). This registration sends the form container the initial state of the `<Field />` as well as it's individual state manipulation and validation methods, while the unregistration deletes the field entry in the parent container's state.

In most cases you will want be unregistering `<Field />`'s as they are unmounted to not pollute the state with entries that are superfluous, however in certain situations it can be advantageous to keep the value around. For example, login forms with multiple stages, you will get a nominal performance improvement by actually unmounting the `<Field />` instead of just hiding it with `display: none`

These entries will also have their validation methods run which _could_ stop the form from submitting without showing anything to the user as the field the error should be attached to is now gone. The best way around this is to make sure the validation passes before unmounting the field, or by having a dynamic validation method that changes what fields are validated based on what is visible.

####

## Example

```js
import React, { Component } from 'react';
import { ReactForms } from '@aaronuu/react-forms';

class FormContainer extends Component {
  render() {
    return (
      <ReactForms
        validate={values => {
          if (!values.password) {
            return { password: 'Password is required' };
          }
          return {};
        }}
      >
        {({
          values,
          touched,
          errors,
          isDirty,
          isValid,
          setValues,
          setFieldValue,
          setErrors,
          setFieldError,
          setTouched,
          setFieldTouched,
          setStatus,
          resetForm,
          submitForm
        }) => {
          return (
            <Fragment>
              <Form>
                <Field
                  name="email"
                  initialValue="new@email.com"
                  validate={value => {
                    if (value !== /email_regex/) {
                      return 'Invalid email';
                    }
                    return null;
                  }}
                />
                <Field name="password" />
                <button>Submit</button>
              </Form>
            </Fragment>
          );
        }}
      </ReactForms>
    );
  }
}
```

## Props

## Caveats

When submitting the form both the field level validators and the form level validators will be run, with the form level errors only being applied if the field level error returns a falsey value

## Authors

- **Aaron Williams** - [aaronnuu](https://github.com/aaronnuu)

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details
