import React, { Component } from 'react';
import isEqual from 'react-fast-compare';
import createContext from 'create-react-context';
import get from 'lodash.get';
import set from 'lodash.set';
import unset from 'lodash.unset';
import {
  isFunction,
  isPromise,
  noop,
  concatenateErrors,
  flattenArray
} from './utils';

const { Provider, Consumer } = createContext();

class ReactForms extends Component {
  static defaultProps = {
    validateOnChange: false,
    validateOnBlur: true,
    validateOnMount: false,
    touchOnChange: true,
    touchOnBlur: true,
    shouldUnregister: true,
    handleSubmit: noop
  };

  state = {
    fields: {},
    status: null,
    submitCount: 0,
    isSubmitting: false,
    isValidating: false
  };
  initialValues = {};

  constructor (props) {
    super(props);

    this.registerField = this.registerField.bind(this);
    this.unregisterField = this.unregisterField.bind(this);
    this.setFormState = this.setFormState.bind(this);
    this.setValues = this.setValues.bind(this);
    this.setFieldValue = this.setFieldValue.bind(this);
    this.setErrors = this.setErrors.bind(this);
    this.setFieldError = this.setFieldError.bind(this);
    this.setTouched = this.setTouched.bind(this);
    this.setFieldTouched = this.setFieldTouched.bind(this);
    this.setStatus = this.setStatus.bind(this);
    this.resetForm = this.resetForm.bind(this);
    this.getValues = this.getValues.bind(this);
    this.getTouched = this.getTouched.bind(this);
    this.getErrors = this.getErrors.bind(this);
    this.runValidations = this.runValidations.bind(this);
    this.submitForm = this.submitForm.bind(this);
    this.getActions = this.getActions.bind(this);
    this.getComputedProps = this.getComputedProps.bind(this);
    this.getFormState = this.getFormState.bind(this);
  }

  registerField (
    name,
    {
      id,
      initialValue,
      initialTouched,
      initialError,
      validate,
      setValue,
      setTouched,
      setError,
      reset
    }
  ) {
    this.setState(prevState => {
      this.initialValues = set({ ...this.initialValues }, name, initialValue);
      return {
        ...prevState,
        fields: {
          ...prevState.fields,
          [name]: {
            id,
            value: initialValue,
            touched: initialTouched,
            error: initialError,
            validate,
            setValue,
            setTouched,
            setError,
            reset
          }
        }
      };
    });
  }

  unregisterField (id) {
    this.setState(prevState => {
      const { fields } = prevState;

      const newFields = { ...fields };
      const newInitialValues = { ...this.initialValues };

      const name = Object.keys(newFields).find(fieldName => {
        if (fields[fieldName].id === id) {
          return true;
        }
      });

      if (name) {
        unset(newFields, name);
        unset(newInitialValues, name);

        this.initialValues = newInitialValues;

        return {
          ...prevState,
          fields: newFields
        };
      } else {
        return null;
      }
    });
  }

  setFormState (state) {
    return new Promise(resolve => {
      this.setState(state, resolve);
    });
  }

  setValues (values, merge = true, shouldValidate = false) {
    const { fields } = this.state;
    const promises = [];
    Object.keys(fields).forEach(name => {
      const value = get(values, name);
      if (!merge || (merge && value !== undefined)) {
        promises.push(fields[name].setValue(value, shouldValidate));
      }
    });
    return Promise.all(promises);
  }

  setFieldValue (name, value, shouldValidate) {
    const { fields } = this.state;
    if (!fields[name]) {
      throw new Error(`Field ${name} does not exist`);
    } else {
      return fields[name].setValue(value, shouldValidate);
    }
  }

  setErrors (errors, merge = false, shouldTouch) {
    const { fields } = this.state;
    const promises = [];
    Object.keys(fields).forEach(name => {
      const error = get(errors, name, null);
      if (!merge || (merge && error === null)) {
        promises.push(fields[name].setError(error, shouldTouch));
      }
    });
    return Promise.all(promises);
  }

  setFieldError (name, error, shouldTouch) {
    const { fields } = this.state;
    if (!fields[name]) {
      throw new Error(`Field ${name} does not exist`);
    } else {
      return fields[name].setError(error, shouldTouch);
    }
  }

  setTouched (touched) {
    const { fields } = this.state;
    const promises = [];
    Object.keys(fields).forEach(name => {
      promises.push(fields[name].setTouched(get(touched, name, false)));
    });
    return Promise.all(promises);
  }

  setFieldTouched (name, touched) {
    const { fields } = this.state;
    if (!fields[name]) {
      throw new Error(`Field ${name} does not exist`);
    } else {
      return fields[name].setTouched(touched);
    }
  }

  setStatus (status) {
    return new Promise(resolve => {
      this.setState(
        prevState => ({
          ...prevState,
          status
        }),
        resolve
      );
    });
  }

  resetForm (values) {
    const { fields } = this.state;
    const promises = [];
    Object.keys(fields).forEach(name => {
      promises.push(fields[name].reset(get(values, name)));
    });
    return Promise.all(promises);
  }

  getValues () {
    const { fields } = this.state;
    return Object.keys(fields).reduce((acc, name) => {
      set(acc, name, fields[name].value);
      return acc;
    }, {});
  }

  getTouched () {
    const { fields } = this.state;
    return Object.keys(fields).reduce((acc, name) => {
      set(acc, name, fields[name].touched);
      return acc;
    }, {});
  }

  getErrors () {
    const { fields } = this.state;
    return Object.keys(fields).reduce((acc, name) => {
      if (fields[name].error !== null) {
        set(acc, name, fields[name].error);
      }
      return acc;
    }, {});
  }

  startSubmit () {
    const { fields } = this.state;

    this.setState(prevState => ({
      ...prevState,
      submitCount: prevState.submitCount + 1,
      isSubmitting: true
    }));

    this.setTouched(
      Object.keys(fields).reduce((acc, name) => {
        set(acc, name, true);
        return acc;
      }, {})
    );
  }

  runValidations () {
    const { fields } = this.state;
    const { validate } = this.props;

    const values = this.getValues();

    this.setState(prevState => ({
      ...prevState,
      isValidating: true
    }));

    const asyncValidators = [];
    const syncValidators = [];

    // Validate all fields then the form
    // If both have validated the same field use
    // the field specific error

    // IF there are async validators then overwrite
    // the sync errors with those
    Object.keys(fields).forEach(name => {
      const fieldValidator = fields[name].validate;

      if (isFunction(fieldValidator)) {
        const maybePromisedError = fieldValidator(fields[name].value);

        if (isPromise(maybePromisedError)) {
          asyncValidators.push({ [name]: maybePromisedError });
        } else {
          syncValidators.push({ [name]: maybePromisedError });
        }
      } else {
        // Make sure every error has a null value if
        // no validation is performed
        syncValidators.push({ [name]: null });
      }
    });

    if (isFunction(validate)) {
      const maybePromisedErrors = validate(values);

      if (isPromise(maybePromisedErrors)) {
        asyncValidators.push(maybePromisedErrors);
      } else {
        syncValidators.push(maybePromisedErrors);
      }
    }

    if (asyncValidators.length === 0) {
      return concatenateErrors(syncValidators);
    } else {
      // Wrap this in a promise to be able to control the
      // resolved value so we can preserve the field name
      // that the error is attached to
      return new Promise(async resolve => {
        const asyncErrors = await Promise.all(
          flattenArray(
            asyncValidators.map(validator => {
              if (!isPromise(validator)) {
                return Object.entries(validator).map(([key, value]) => {
                  return new Promise(async resolve => {
                    const error = await value;
                    resolve({ [key]: error });
                  });
                });
              } else {
                return validator;
              }
            })
          )
        );
        resolve({
          ...concatenateErrors(syncValidators),
          ...concatenateErrors(asyncErrors)
        });
      });
    }
  }

  executeSubmit () {
    const { handleSubmit } = this.props;

    const values = this.getValues();
    const errors = this.getErrors();

    const isValid = Object.keys(errors).length <= 0;

    if (isValid) {
      const submit = handleSubmit(values, this.getActions());
      if (isPromise(submit)) {
        submit.then(() => {
          this.setState(prevState => ({
            ...prevState,
            isSubmitting: false
          }));
        });
        return;
      }
    }
    this.setState(prevState => ({
      ...prevState,
      isSubmitting: false
    }));
  }

  submitForm (e) {
    const { isSubmitting } = this.state;

    if (e && e.preventDefault) {
      e.preventDefault();
    }

    if (!isSubmitting) {
      this.startSubmit();

      const maybePromisedErrors = this.runValidations();

      if (isPromise(maybePromisedErrors)) {
        maybePromisedErrors.then(errors => {
          this.setErrors(errors, false, true).then(this.executeSubmit);
        });
      } else {
        this.setErrors(maybePromisedErrors, false, true).then(
          this.executeSubmit
        );
      }
    }
  }

  getComputedProps () {
    const values = this.getValues();
    const errors = this.getErrors();

    return {
      isDirty: !isEqual(this.initialValues, values),
      isValid: Object.keys(errors).length <= 0
    };
  }

  getActions () {
    return {
      setValues: this.setValues,
      setFieldValue: this.setFieldValue,
      setErrors: this.setErrors,
      setFieldError: this.setFieldError,
      setTouched: this.setTouched,
      setFieldTouched: this.setFieldTouched,
      setStatus: this.setStatus,
      resetForm: this.resetForm,
      submitForm: this.submitForm
    };
  }

  getFormState () {
    const { fields, ...restState } = this.state;

    return {
      ...this.getComputedProps(),
      ...this.getActions(),
      ...restState,
      values: this.getValues(),
      touched: this.getTouched(),
      errors: this.getErrors()
    };
  }

  render () {
    const {
      render,
      children,
      validate,
      initialValues,
      validateOnChange,
      validateOnBlur,
      validateOnMount,
      touchOnChange,
      touchOnBlur,
      shouldUnregister
    } = this.props;
    const formState = this.getFormState();

    return (
      <Provider
        value={{
          ...formState,
          initialValues,
          validateOnChange,
          validateOnBlur,
          validateOnMount,
          touchOnChange,
          touchOnBlur,
          shouldUnregister,
          registerField: this.registerField,
          unregisterField: this.unregisterField,
          validateForm: validate,
          setFormState: this.setFormState
        }}
      >
        {isFunction(children)
          ? children(formState)
          : isFunction(render)
            ? render(formState)
            : null}
      </Provider>
    );
  }
}

class AsyncValuesWrapper extends Component {
  static defaultProps = {
    asyncValuesReady: true
  };

  initialized = this.getAsyncValuesReady();

  getAsyncValuesReady () {
    const { asyncValuesReady, innerProps = {} } = this.props;
    if (isFunction(asyncValuesReady)) {
      return asyncValuesReady(innerProps);
    } else {
      return asyncValuesReady;
    }
  }

  getKey = () => {
    if (!this.initialized) {
      if (this.getAsyncValuesReady()) {
        this.initialized = true;
      } else {
        return false;
      }
    }
    return this.initialized;
  };

  render () {
    const { asyncValuesReady, innerProps, ...rest } = this.props;

    return <ReactForms key={this.getKey()} {...rest} />;
  }
}

export const FormConsumer = Consumer;

export default AsyncValuesWrapper;
