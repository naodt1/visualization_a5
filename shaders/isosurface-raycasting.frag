#version 300 es
precision highp int;
precision highp float;
uniform highp sampler3D volume;

// the resolution of the volume (number of voxels in each dimension)
uniform ivec3 volume_dims;

uniform float iso_value;
uniform float dt_scale;
uniform float sampling_distance;
uniform bool illumination_active;
uniform bool binary_search_active;
uniform vec3 light_position;

uniform float specular_reflection_constant;
uniform float diffuse_reflection_constant;
uniform float ambient_reflection_constant;
uniform float shininess_constant;
uniform vec3 specular_light_intensity;
uniform vec3 diffuse_light_intensity;
uniform vec3 ambient_light_intensity;


in vec3 eye_to_surface_dir;
flat in vec3 eye_pos;
out vec4 color;

float sample_data_volume (vec3 p){
	return texture(volume, p).x;
}

vec3 phong_illumination(vec3 p, vec3 ray_dir, vec3 normal){
	normal = normalize(normal);
	vec3 towards_light = normalize(light_position - p);

	vec3 ambient = ambient_light_intensity * ambient_reflection_constant;
	float lambertian = max(0.f, dot(normal, towards_light));
	vec3 diffuse = diffuse_reflection_constant * lambertian * diffuse_light_intensity;
	
	vec3 view_dir = normalize(-ray_dir);
	vec3 reflected_light_vector = reflect(-towards_light, normal);
	float specular_coeff = pow( max(0.f, dot(view_dir, reflected_light_vector)), shininess_constant); 
	vec3 specular = specular_reflection_constant * specular_coeff * specular_light_intensity;

	return ambient + diffuse + specular;
}

// Task 2a: Gradient estimation using central differences
vec3 estimate_gradient(vec3 q) {
	// Step size: one voxel in each dimension
    vec3 step = 1.0 / vec3(volume_dims);

    //Central difference method to estimate the gradient
	float vpos_x = sample_data_volume(q + vec3(step.x, 0.0, 0.0));
    float vneg_x = sample_data_volume(q - vec3(step.x, 0.0, 0.0));

    float vpos_y = sample_data_volume(q + vec3(0.0, step.y, 0.0));
    float vneg_y = sample_data_volume(q - vec3(0.0, step.y, 0.0));

    float vpos_z = sample_data_volume(q + vec3(0.0, 0.0, step.z));
    float vneg_z = sample_data_volume(q - vec3(0.0, 0.0, step.z));

    vec3 gradient = vec3(
		(vpos_x - vneg_x) / (2.0 * step.x),
        (vpos_y - vneg_y) / (2.0 * step.y),
        (vpos_z - vneg_z) / (2.0 * step.z)
	);
	
	return gradient;
}


vec2 intersect_box(vec3 orig, vec3 dir) {
	const vec3 box_min = vec3(0);
	const vec3 box_max = vec3(1);
	vec3 inv_dir = 1.0 / dir;
	vec3 tmin_tmp = (box_min - orig) * inv_dir;
	vec3 tmax_tmp = (box_max - orig) * inv_dir;
	vec3 tmin = min(tmin_tmp, tmax_tmp);
	vec3 tmax = max(tmin_tmp, tmax_tmp);
	float t0 = max(tmin.x, max(tmin.y, tmin.z));
	float t1 = min(tmax.x, min(tmax.y, tmax.z));
	return vec2(t0, t1);
}

bool inside_volume_bounds(vec3 p){
	return all(greaterThanEqual(p, vec3(0.f))) && all(lessThanEqual(p, vec3(1.f)));
}

void main(void) { 

    // calculate ray direction as normalized vector
	vec3 ray_dir = normalize(eye_to_surface_dir);

    // calculate distance to intersections between ray and volume
	vec2 t_hit = intersect_box(eye_pos, ray_dir);
	if (t_hit.x > t_hit.y) {
		discard;
	}

    // if the distance to first intersection of the ray with the box is negative, this intersection is behind the camera
    // we want the ray to start at the ray origin instead, so the distance along ray of the starting point should be 0
	t_hit.x = max(t_hit.x, 0.0);
	
	// compute point where ray traversal begins and take small step to make sure we are inside the volume
    vec3 p = eye_pos + (t_hit.x * ray_dir);
	p += ray_dir * 0.00001;


	// YOUR CODE HERE...
	// 1. store the data value at the previous sample point
	float last_val = sample_data_volume(p);

	// 2. traverse the volume
	while (inside_volume_bounds(p)) {

		// 3. sample the scalar value at the current point
		float current_val = sample_data_volume(p);

		// 4. check if the iso-value lies between the last and current sample values
		if ((last_val <= iso_value && current_val > iso_value) ||
		    (last_val >= iso_value && current_val < iso_value)) {

			// 5. iso-surface found — assign a flat color and stop traversal
			if (illumination_active) {  // check for active illumination and call phong illumination
				vec3 gradient = estimate_gradient(p);
				vec3 illuminated = phong_illumination(p, ray_dir, gradient);
				color = vec4(illuminated, 1.0);
			} else {
				color = vec4(1.0, 0.0, 0.0, 1.0);
			}
			break;
		}

		// 6. update last value for the next iteration
		last_val = current_val;

		// advance the ray
		p += ray_dir * sampling_distance;
	}
}