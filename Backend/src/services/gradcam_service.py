import numpy as np
import tensorflow as tf
import cv2

_grad_model_cache = {}

def get_last_conv_layer(model):
    """Cari layer Conv2D terakhir di model"""
    for layer in reversed(model.layers):
        if isinstance(layer, tf.keras.layers.Conv2D):
            return layer.name
    raise ValueError("No Conv2D layer found in model.")


def make_gradcam_heatmap(img_array, base_model, last_conv_layer_name=None, pred_index=None):
    """
    img_array        : Input image array (1, H, W, 3)
    base_model       : Model lengkap
    last_conv_layer_name: Nama conv layer terakhir
    pred_index       : Index kelas untuk Grad-CAM
    """

    if last_conv_layer_name is None:
        last_conv_layer_name = get_last_conv_layer(base_model)

    cache_key = (id(base_model), last_conv_layer_name)
    grad_model = _grad_model_cache.get(cache_key)
    if grad_model is None:
        last_conv_layer = base_model.get_layer(last_conv_layer_name)
        grad_model = tf.keras.models.Model(
            inputs=base_model.input,
            outputs=[last_conv_layer.output, base_model.output]
        )
        _grad_model_cache[cache_key] = grad_model

    with tf.GradientTape() as tape:
        conv_outputs, predictions = grad_model(img_array)

        if isinstance(predictions, list):
            predictions = predictions[0]

        if not isinstance(predictions, tf.Tensor):
            predictions = tf.convert_to_tensor(predictions)

        if pred_index is None:
            pred_index = int(tf.argmax(predictions[0]))
        else:
            pred_index = int(pred_index)

        num_classes = int(predictions.shape[-1])

        if num_classes == 1:
            loss = predictions[0, 0]
        else:
            loss = predictions[0, pred_index]

    grads = tape.gradient(loss, conv_outputs)
    
    if grads is None:
        raise ValueError("Gradients are None.")
    
    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))

    conv_outputs = conv_outputs[0]
    heatmap = tf.reduce_sum(conv_outputs * pooled_grads, axis=-1)

    heatmap = tf.maximum(heatmap, 0)  
    heatmap /= (tf.reduce_max(heatmap) + 1e-8) 
    
    return heatmap.numpy()


def overlay_heatmap(original_img, heatmap, alpha=0.4):
    """
    original_img: BGR image (H,W,3) - OpenCV format
    heatmap     : Output dari make_gradcam_heatmap
    alpha       : Transparansi overlay
    """
    # Resize heatmap to match original image
    heatmap_resized = cv2.resize(heatmap, (original_img.shape[1], original_img.shape[0]))
    
    # Apply colormap
    heatmap_uint8 = np.uint8(255 * heatmap_resized)
    heatmap_color = cv2.applyColorMap(heatmap_uint8, cv2.COLORMAP_JET)

    # Superimpose
    superimposed_img = cv2.addWeighted(original_img, 1 - alpha, heatmap_color, alpha, 0)
    
    return superimposed_img, heatmap_color
