import numpy as np
import tensorflow as tf
import cv2

def get_last_conv_layer(model):
    """Cari layer Conv2D terakhir di model"""
    for layer in reversed(model.layers):
        if isinstance(layer, tf.keras.layers.Conv2D):
            return layer.name
    raise ValueError("No Conv2D layer found in model.")


def make_gradcam_heatmap(img_array, base_model, classifier_layers=None, last_conv_layer_name=None, pred_index=None):
    """
    img_array        : Input image array (1, H, W, 3)
    base_model       : Model lengkap
    classifier_layers: List of layers yang membentuk head (optional)
    last_conv_layer_name: Nama conv layer terakhir
    pred_index       : Index kelas untuk Grad-CAM
    """

    if last_conv_layer_name is None:
        last_conv_layer_name = get_last_conv_layer(base_model)

    last_conv_layer = base_model.get_layer(last_conv_layer_name)

    grad_model = tf.keras.models.Model(
        inputs=base_model.input,
        outputs=[last_conv_layer.output, base_model.output]
    )

    with tf.GradientTape() as tape:
        conv_outputs, predictions = grad_model(img_array)
        
        print(f"GradCAM - Conv outputs shape: {conv_outputs.shape}")
        print(f"GradCAM - Type of predictions: {type(predictions)}")
        
        if isinstance(predictions, list):
            print(f"GradCAM - Model has {len(predictions)} outputs, using first one")
            predictions = predictions[0]
        
        if not isinstance(predictions, tf.Tensor):
            predictions = tf.convert_to_tensor(predictions)
        
        print(f"GradCAM - Predictions shape: {predictions.shape}")
        print(f"GradCAM - Predictions values: {predictions.numpy()}")
        
        if pred_index is None:
            pred_index = int(tf.argmax(predictions[0]))
        else:
            pred_index = int(pred_index)
        
        num_classes = int(predictions.shape[-1])
        print(f"GradCAM - Number of classes: {num_classes}")
        print(f"GradCAM - Pred index: {pred_index}")
        
        if pred_index >= num_classes:
            raise ValueError(
                f"pred_index ({pred_index}) >= num_classes ({num_classes}). "
                f"Model output has {num_classes} classes but trying to access index {pred_index}"
            )

        if num_classes == 1:
            loss = predictions[0, 0]
            print("GradCAM - Using sigmoid output")
        else:
            loss = predictions[0, pred_index]
            print(f"GradCAM - Using softmax output for class {pred_index}")

    grads = tape.gradient(loss, conv_outputs)
    
    if grads is None:
        raise ValueError(
            "Gradients are None. This might happen if:\n"
            "1. The model is not trainable\n"
            "2. There's no connection between conv layer and output\n"
            "3. The layer is frozen"
        )
    
    print(f"GradCAM - Gradients shape: {grads.shape}")
    
    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
    print(f"GradCAM - Pooled gradients shape: {pooled_grads.shape}")

    conv_outputs = conv_outputs[0]
    
    heatmap = tf.reduce_sum(conv_outputs * pooled_grads, axis=-1)
    print(f"GradCAM - Heatmap shape before normalization: {heatmap.shape}")

    heatmap = tf.maximum(heatmap, 0)  
    heatmap /= (tf.reduce_max(heatmap) + 1e-8) 

    print(f"GradCAM - Heatmap min: {tf.reduce_min(heatmap).numpy()}, max: {tf.reduce_max(heatmap).numpy()}")
    
    return heatmap.numpy()


def overlay_heatmap(original_img, heatmap, alpha=0.4, blur=True, invert=True):
    """
    original_img: RGB image (H,W,3)
    heatmap     : Output dari make_gradcam_heatmap
    alpha       : Transparansi overlay
    blur        : Apply Gaussian blur
    invert      : Invert heatmap warna
    """
    
    print(f"Overlay - Original image shape: {original_img.shape}")
    print(f"Overlay - Heatmap shape: {heatmap.shape}")

    heatmap = cv2.resize(heatmap, (original_img.shape[1], original_img.shape[0]))

    if blur:
        heatmap = cv2.GaussianBlur(heatmap, (25, 25), 0)
    
    if invert:
        heatmap = 1.0 - heatmap  

    heatmap = np.uint8(255 * heatmap)
    
    heatmap_color = cv2.applyColorMap(heatmap, cv2.COLORMAP_JET)

    superimposed_img = cv2.addWeighted(original_img, 1 - alpha, heatmap_color, alpha, 0)
    
    print(f"Overlay - Final image shape: {superimposed_img.shape}")
    
    return superimposed_img